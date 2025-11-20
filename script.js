document.addEventListener('DOMContentLoaded', () => {
    // === ELEMENTE DOM ===
    const uploadInput = document.getElementById('upload-file');
    const imageElement = document.querySelector('.img');
    const imgWrapper = document.querySelector('.img-wrapper');
    const selectionCanvas = document.querySelector('.selection-canvas');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const saveButton = document.querySelector('.save-btn');
    const ctx = selectionCanvas.getContext('2d');

    const placeholderText = document.querySelector('.placeholder-text');

    // === VARIABILE GLOBALE ===
    let originalImage = null; // Tine imaginea originala
    let currentTool = 'select';
    let isDrawing = false; // true daca mouseul e apasat pe canvas
    let startX = 0; // Pozitia X de start a selectiei
    let startY = 0; // Pozitia Y de start a selectiei
    let currentSelection = { x: 0, y: 0, w: 0, h: 0 }; // Dreptunghiul de selectie curent
    let currentFillColor = '#FF0000'; // Culoare rosie default
    let effectModal = null; // Pop-up-ul pentru alegerea culorii de umplere

    let isMoving=false; //pt mutare cu shift apasat

    //scalare ca sa incapa imaginea pe ecran
    let scaleX = 1;
    let scaleY = 1;

    let scaleModal = null; //pt pop-up
    let textModal = null; //pt pop-up text
    
    //pt propietatile textului
    let currentTextSize = 30; 
    let currentTextColor = '#FFFFFF'; 

    const clearCanvas = () => {
        ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    };

    //aliniere canvas peste imagine
    const updateCanvasToMatchImage = () => {
        if (!originalImage) return;

    // =========== Calculeaza dimensiunile si pozitia imaginii afisate pe ecran ============
        const wrapperW = imgWrapper.clientWidth; //continut + padding (fara border, margini)
        const wrapperH = imgWrapper.clientHeight; //wrapper reprezinta noile dimensiuni ale imaginii scalate pe ecran.
        const imgOrigW = originalImage.width; //dimensiunile originale ale imaginii (nescalate)
        const imgOrigH = originalImage.height;
        let dW, dH, dX, dY; // dW=DisplayWidth, dH=DisplayHeight, dX=DisplayX, dY=DisplayY
        const ratioImage = imgOrigW / imgOrigH; 

        if (ratioImage > (wrapperW / wrapperH)) {
            dW = wrapperW;
            dH = wrapperW / ratioImage;
        } else {
            dH = wrapperH;
            dW = wrapperH * ratioImage;
        }
        dX = (wrapperW - dW) / 2;
        dY = (wrapperH - dH) / 2;

        //dimensiunea canvasului = dimensiunea imaginii afisate
        selectionCanvas.width = dW;
        selectionCanvas.height = dH;
    
        //canvasul incepe exact de unde incepe si imaginea
        selectionCanvas.style.left = `${dX}px`;
        selectionCanvas.style.top = `${dY}px`;

        //noua rata de scalare(imagine originala/scalata sa incapa pe ecran)
        scaleX = imgOrigW / dW;
        scaleY = imgOrigH / dH;

        clearCanvas(); //facem canvas-ul gol, initial.
    };

    window.addEventListener('resize', updateCanvasToMatchImage); //daca dam resize la broswer, se reapealeaza functia

    

 // ============ 1. INCARCARE FISIER ====================

 //functia asta va fi apelata, fie la apelul de la buton, fie prin drag & drop (mai jos)
 const loadImageFile = (file) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader(); //citeste fisierul
        reader.onload = (event) => { //cand termina de citit
            originalImage = new Image(); //creeaza imaginea
            originalImage.onload = () => { //cand se trasnforma fisierul in imagine
                imageElement.src = originalImage.src;  //se adauga
                setActiveTool('select'); //default tool select
                updateCanvasToMatchImage(); //se face canvas peste imagine
                placeholderText.classList.add("hidden");
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}; 
function preventDefaults(e) { //anulam comportamentul default de la buton/drag & drop
    e.preventDefault();
    e.stopPropagation();
}

//1. pt upload prin buton
uploadInput.addEventListener('change', (e) => {
    preventDefaults(e);
    loadImageFile(e.target.files[0]);
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    imgWrapper.addEventListener(eventName, preventDefaults); 
});

// Feedback vizual la drag
['dragenter', 'dragover'].forEach(eventName => { //la evenimentele astea adaugam clasa asta, care in css va face un contur cu galben
    imgWrapper.addEventListener(eventName, () => imgWrapper.classList.add('highlight'))
});
['dragleave', 'drop'].forEach(eventName => {
    imgWrapper.addEventListener(eventName, () => imgWrapper.classList.remove('highlight')); //stergem clasa repectiva, dispare conturul
});


//2. pt upload prin drag & drop
imgWrapper.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        loadImageFile(files[0]);
    }
});


// =========== 2. GESTIONARE UNELTE ========
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            const toolId = button.id.replace('-tool', ''); 
            //pt o gestionare mai simpla in cod, facem fiecare id sa fie fara tool in nume
            setActiveTool(toolId);
        });
    });

    const setActiveTool = (toolId) => {
        if (!originalImage && toolId !== 'select') return;
        isMoving = false;
        if (currentSelection.w > 0 && currentSelection.h > 0) {
            if (toolId === 'crop') {
                applyCrop();
            } else if (toolId === 'delete') {
                deleteSection(currentSelection);
            } else if (toolId === 'effect') {
                 // nu se apeleaza nimic, deoarece utilizatorul trebuie sa aleaga culoarea (logica se afla in moseup)
            } 
        }
        clearCanvas();
        currentSelection = { x: 0, y: 0, w: 0, h: 0 };
        toolButtons.forEach(btn => btn.classList.remove('active')); //scoate stilul de activ de la celallte
        document.getElementById(`${toolId}-tool`).classList.add('active'); //face activ butonul apasat
        currentTool = toolId;

        selectionCanvas.style.pointerEvents = (toolId === 'crop' || toolId === 'select' || toolId === 'text' || toolId === 'delete' || toolId === 'effect') ? 'auto' : 'none';

        if (toolId === 'scale') {
            showScaleModal(); //afiseaz popup pt scale 
            setActiveTool('select');
        }
        if (toolId === 'text') {
            //afiseaza popup pt setari text
            showTextModal();
        }
        if(toolId==="effect")
            {
                showEffectModal();
                //afiseaza popup pt effect( fill)
            }
    };

// ---------------- 3. SELECTARE ---------------------

    const drawSelection = () => {
        clearCanvas();
        if (currentSelection.w <= 0 || currentSelection.h <= 0) return;

        //aplica un efect negru pe tot transparent (doar pentru 'crop')
        if (currentTool === 'crop') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, selectionCanvas.width, selectionCanvas.height);
            ctx.clearRect(currentSelection.x, currentSelection.y, currentSelection.w, currentSelection.h);
            //in zona selectata de utilizator, se elimina efectul
        }
        
        //conturul zonei selectata de noi
        if(isMoving) 
            ctx.strokeStyle= '#00FF00' 
            
        else ctx.strokeStyle='#FFC896';
        ctx.lineWidth = 2;
        ctx.strokeRect(currentSelection.x, currentSelection.y, currentSelection.w, currentSelection.h);
    };


// ------------ Functia care calculeaza coordonatele mouse-ului RELATIV la canvas ----------------
    const getCanvasCoords = (e) => {
        const rect = selectionCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    selectionCanvas.addEventListener('mousedown', (e) => {
        if (currentTool !== 'select' && currentTool !== 'crop' && currentTool !== 'text' && currentTool!=="delete" && currentTool!=="effect" || !originalImage) return;

        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;

        if (e.shiftKey && currentSelection.w > 0 && currentSelection.h > 0 && currentTool === 'select') {
            //daca mouse-ul e in interiorul selectiei
            if (startX >= currentSelection.x && startX <= currentSelection.x + currentSelection.w &&
                startY >= currentSelection.y && startY <= currentSelection.y + currentSelection.h) {
                isMoving = true; //seteaza variabila globala la true
            } else {
                isMoving = false; //shift e apasat, dar inafara selectiei, deci incepe sa se faca o selectie noau
                currentSelection = { x: 0, y: 0, w: 0, h: 0 };
            }
        } else {
            isMoving = false; // la fel ca precedenta instructiune, aici se intra cand nu e shift deloc apasat
            currentSelection = { x: 0, y: 0, w: 0, h: 0 };
        }

    });

    // Folosim 'document' pentru a prinde mouse-ul chiar daca iese din canvas
    document.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;

        const coords = getCanvasCoords(e);
        
        const currentX = coords.x;
        const currentY = coords.y;


// AICI E CODUL PENTRU MUTAREA CU SHIFT A SELECTIEI
        if (isMoving) {
            //cat se misca
            const miscareX = currentX - startX;
            const miscareY = currentY - startY;

            //noua pozitie
            let newX = currentSelection.x + miscareX;
            let newY = currentSelection.y + miscareY;

           //limitare sa nu iasa din canvas
            newX = Math.max(0, newX);
            newX = Math.min(selectionCanvas.width - currentSelection.w, newX);

            //limitare sa nu iasa din canvas dar pe inaltime
            newY = Math.max(0, newY);
            newY = Math.min(selectionCanvas.height - currentSelection.h, newY);

            //aplica noile pozitii
            currentSelection.x = newX;
            currentSelection.y = newY;

            // actualizare variabile
            startX = currentX;
            startY = currentY;

            drawSelection(); //pune pe ecran noua selecti
            return; //iesire din functie, nu se mai realizeaza selectia normala
        }

// AICI E CODUL PENTRU SELECTIA NORMALA, FARA SHIFT.
    

        //calculeaza dimensiunea selectiei
        currentSelection.x = Math.min(startX, currentX);
        currentSelection.y = Math.min(startY, currentY);
        currentSelection.w = Math.abs(startX - currentX);
        currentSelection.h = Math.abs(startY - currentY);

        //Limiteaza selectia sa nu iasa din canvas
        currentSelection.x = Math.max(0, currentSelection.x);
        currentSelection.y = Math.max(0, currentSelection.y);
        currentSelection.w = Math.min(selectionCanvas.width - currentSelection.x, currentSelection.w);
        currentSelection.h = Math.min(selectionCanvas.height - currentSelection.y, currentSelection.h);

        drawSelection();
    });

    // Folosim 'document' pentru a ne opri chiar daca eliberam mouse-ul inafara canvas-ului
    document.addEventListener('mouseup', () => {
        if (!isDrawing) return;
        isDrawing = false;
        const wasMoving = isMoving; // salvam starea
        isMoving = false;
        
        //daca selectia e valida ( chiar si dupa mutare), o redesenam, culoarea galbena
        if (currentSelection.w > 0 && currentSelection.h > 0) {
             drawSelection();
        }
       
        if (currentTool === 'crop' && currentSelection.w > 0 && currentSelection.h > 0) {
            applyCrop();
        }
        if(currentTool==="text"&&currentSelection.w>0&&currentSelection.h>0)
            {
                writeText(currentSelection);
            }
        if(currentTool==="delete"&&currentSelection.w>0&&currentSelection.h>0)
            {
                deleteSection(currentSelection);
            }
        if(currentTool==="effect"&&currentSelection.w>0&&currentSelection.h>0)
            {
                applyEffect(currentSelection);
            }
    });


// --------------- 3. FUNCTIA DE STERGERE SELECTIE -----------------
    function deleteSection(currentSelection)
    {
        if(!originalImage) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalImage.width;
        tempCanvas.height = originalImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImage, 0, 0);

        //zona de stergere reala(calculata cu scala)
        const originalDeleteX = currentSelection.x * scaleX;
        const originalDeleteY = currentSelection.y * scaleY;
        const originalDeleteW = currentSelection.w * scaleX;
        const originalDeleteH = currentSelection.h * scaleY;

        //stergerea reprezinta transformarea in alb
        tempCtx.fillStyle = 'white'
        tempCtx.fillRect( 
            originalDeleteX,
            originalDeleteY,
            originalDeleteW,
            originalDeleteH
        );

        //actualizare imagine
        originalImage.src = tempCanvas.toDataURL();
        //actualizare imagine pe site
        imageElement.src = originalImage.src;

        //curatare
        clearCanvas();
        currentSelection = { x: 0, y: 0, w: 0, h: 0 };
        updateCanvasToMatchImage(); //realiniare canvas
        setActiveTool('select'); //revenire la unealta default
    }


// 4. FUNCTIA DE APLICARE EFECT (UMPLERE CU O CULOARE SELECTATA) ---
    const applyEffect = (currentSelection) => {
        if (!originalImage || currentSelection.w <= 0 || currentSelection.h <= 0) return;

        // Converteste selectia la dimensiunile originale
        const originalFilterX = currentSelection.x * scaleX;
        const originalFilterY = currentSelection.y * scaleY;
        const originalFilterW = currentSelection.w * scaleX;
        const originalFilterH = currentSelection.h * scaleY;

        // canvas temporar 
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalImage.width;
        tempCanvas.height = originalImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // trasnfer imagine originala in canvas temporar
        tempCtx.drawImage(originalImage, 0, 0);

        // Umplerea zonei
        tempCtx.fillStyle = currentFillColor;
        tempCtx.fillRect(
            originalFilterX,
            originalFilterY,
            originalFilterW,
            originalFilterH
        );

        // Transfer catre imaginea originala a noului canvas
        originalImage.src = tempCanvas.toDataURL();
        imageElement.src = originalImage.src;

        // curatare
        clearCanvas();
        currentSelection = { x: 0, y: 0, w: 0, h: 0 };
        updateCanvasToMatchImage(); 
        setActiveTool('select');
    };

// ------  POP UP PT ALEGERE CULOARE DE UMPLERE ------------
    const showEffectModal = () => {
        if (effectModal) return;
        if (!originalImage) return;

        effectModal = document.createElement('div');
        effectModal.className = 'modal-overlay'; 
        
        effectModal.innerHTML = `
            <div class="modal">
                <h3>Fill Area</h3>
                <label> 
                    Choose color: 
                    <input type="color" id="fill-color" value="${currentFillColor}" style="width: 80px; height: 30px; padding: 0;"> 
                </label>
                <div style="display: flex; justify-content: flex-start; gap: 10px; margin-top: 15px;">
                    <button id="cancel-fill">Cancel</button>
                    <button id="apply-fill">Apply Effect</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(effectModal); //adaugare in dom

        //preluare date din pop-up
        const colorInput = document.getElementById('fill-color');
        const applyButton = document.getElementById('apply-fill');
        const cancelButton = document.getElementById('cancel-fill');

        const closeModal = () => {
            if (effectModal) {
                document.body.removeChild(effectModal);//stergere din dom
                effectModal = null; //culoare e null
            }
        };

        cancelButton.addEventListener('click', closeModal);
        
        applyButton.addEventListener('click', () => {
            //actualizare culoare in variabila globala
            currentFillColor = colorInput.value;
            closeModal(); //inchidere pop-up
        });
    };



// -------------------- 5. ADAUGARE TEXT ---------------------------------

    function writeText(selection)
    {
        if(!originalImage) return;

        //creeaza elementul in care se scrie HTML
        const textInput=document.createElement("input");
        textInput.type="text";
        textInput.placeholder="Write...";
        textInput.style.position="absolute";
        textInput.style.fontSize=currentTextSize + "px";
        textInput.style.color=currentTextColor;
        
        // obtine pozitia absoluta a imaginii
        const wrapperRect = imgWrapper.getBoundingClientRect();
        
        const canvasLeftOffset = parseFloat(selectionCanvas.style.left) || 0;
        const canvasTopOffset = parseFloat(selectionCanvas.style.top) || 0;

        // DE LA CANVAS (Calculeaza pozitia finala a textului prin top,left,width,height din css (am setat mai sus position ca absolute))
        textInput.style.left = `${wrapperRect.left + canvasLeftOffset + selection.x}px`; 
        textInput.style.top = `${wrapperRect.top + canvasTopOffset + selection.y}px`;
        textInput.style.width = `${selection.w}px`;
        textInput.style.height = `${selection.h}px`;
        // DE LA CANVAS

        textInput.style.border="2px dashed #FF00FF"; 
        textInput.style.textAlign='center';
        textInput.style.zIndex=10; //sa fie peste toate elementele cu care se suprapune
        textInput.style.backgroundColor="transparent"; // il facem transparent pentru a vedea imaginea sub el

        document.body.appendChild(textInput);
        textInput.focus();
    

    function finalizeText() 
    {
        const textToWrite = textInput.value; 
        if(textToWrite.trim()!=="")
            {
                //creare canvas temporar copie la cel original
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = originalImage.width;
                tempCanvas.height = originalImage.height;
                const tempCtx = tempCanvas.getContext('2d');

                tempCtx.drawImage(originalImage, 0, 0); //punem imaginea in canvas, in coltul din stanga sus (0,0)

                // Calculeaza pozitiile si dimensiunea fontului pe imaginea orignala inmultiind cu scale.
                const originalTextX = (selection.x + selection.w / 2) * scaleX;
                const originalTextY = (selection.y + selection.h * 0.9) * scaleY;
                const originalFontSize = currentTextSize * scaleY; // Folosim currentTextSize din modal

                //desenare text pe canvas
                tempCtx.fillStyle = currentTextColor; // Folosim currentTextColor din modal
                tempCtx.font = `bold ${originalFontSize}px sans-serif`;
                tempCtx.textAlign = 'center';

                tempCtx.fillText(
                    textToWrite, 
                    originalTextX, 
                    originalTextY 
                );
                originalImage.src = tempCanvas.toDataURL(); //actualizam imaginea originala
                imageElement.src = originalImage.src; //actualizam imaginea pe care o vede utilizatorul pe site

                document.body.removeChild(textInput); 
                clearCanvas();
                currentSelection= {x:0, y: 0, w:0, h: 0};
                setActiveTool("select"); //se revine la unealta default
            } else {
                //sterge elementul de input 
                 document.body.removeChild(textInput);
                 clearCanvas();
                 setActiveTool("select"); //se revine default la select
            }
    }
    //verificari taste apasate
    //1. ENTER
    textInput.addEventListener("keydown",(e) =>
    {
        if (e.key==="Enter")
            { e.preventDefault(); // nu mai face automat refresh la pagina.
        finalizeText();
            }
    })
    //2. CANCEL
    textInput.addEventListener('keydown', (e) => {
             if (e.key === 'Escape') {
                 document.body.removeChild(textInput); //dispare de pe ecran
                 clearCanvas();
                 setActiveTool("select"); //revenim la select
             }
        });
    }


 // ----------------- 6. CROP --------------------------
    
    const applyCrop = () => {
        if (!originalImage || currentSelection.w <= 0 || currentSelection.h <= 0) return;

        // 1. Converteste selectia de pe ecran la dimensiunile originale inmultiind cu scale
        const originalCropX = currentSelection.x * scaleX;
        const originalCropY = currentSelection.y * scaleY;
        const originalCropW = currentSelection.w * scaleX;
        const originalCropH = currentSelection.h * scaleY;

        // 2. Creaza canvas temporar pentru decupare
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalCropW;
        tempCanvas.height = originalCropH;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Deseneaza DOAR portiunea selectata din imaginea originala
        tempCtx.drawImage(
            originalImage, //imaginea originala
            originalCropX, originalCropY, originalCropW, originalCropH, // zona dorita
            0, 0, originalCropW, originalCropH // locul in care putem zona dorita, in noul canvas (de la coltul din stanga sus, cu width si height dorite)
        );

        // 3. Actualizeaza imaginea originala cu cea decupata
        originalImage.src = tempCanvas.toDataURL(); //functie care face exact asta
        originalImage.width = originalCropW;
        originalImage.height = originalCropH;
        imageElement.src = originalImage.src; // Actualizeaza imaginea de pe site, ceea ce vede utilizatorul

        // Reseteaza selectia, canvas, scale nou.
        currentSelection = { x: 0, y: 0, w: 0, h: 0 };
        clearCanvas();
        updateCanvasToMatchImage(); 
    };

    //FINAL CROP







 // ----- POP UP PT ALEGERE PROPIETATI TEXT -------
    const showTextModal= () => {
        if (textModal) return; // in caz de cumva e deja deschis 
        if (!originalImage) return;

        textModal = document.createElement('div');
   
        //CLASA DEFINITA IN CSS PENTRU TOATE MODALURILE (POPUP-URILE)
        textModal.className = 'modal-overlay'; 
        
        textModal.innerHTML = `
            <div class="modal">
                <h3>Text Properties</h3>
                <label> 
                    Font Size (px): 
                    <input type="number" id="text-size" value="${currentTextSize}" min="8" style="width: 80px;"> 
                </label>
                <label> 
                    Color: 
                    <input type="color" id="text-color" value="${currentTextColor}" style="width: 80px; height: 30px; padding: 0;"> 
                </label>
                <div style="display: flex; justify-content: flex-start; gap: 10px; margin-top: 15px;">
                    <button id="cancel-text-modal">Cancel</button>
                    <button id="apply-text-modal">Apply</button>
                </div>
            </div>
        `;
        
        // Adauga modalul in DOM 
        document.body.appendChild(textModal);
    
        // preluare date
    
        const sizeInput = document.getElementById('text-size');
        const colorInput = document.getElementById('text-color');
        const applyButton = document.getElementById('apply-text-modal');
        const cancelButton = document.getElementById('cancel-text-modal');
    
        const closeModal = () => {
            if (textModal) {
                document.body.removeChild(textModal); //scoate din dom
                textModal = null;
            }
        };
    
        cancelButton.addEventListener('click', closeModal);
        
        applyButton.addEventListener('click', () => {
            const newSize = parseInt(sizeInput.value);
            const newColor = colorInput.value;
    
            if (newSize > 0) { //verificare daca e valid
                // Actualizeaza noile variabile pt text
                currentTextSize = newSize;
                currentTextColor = newColor; 
                closeModal(); //scoate din dom
            } else {
                alert('Text size must be a positive number.');
            }
        });
    };



// ----------------- 7. SCALARE ------------------


    //POP UP PT ALEGERE DIMENSIUNI NOI 
    const showScaleModal = () => {
        if (scaleModal) return; // daca pop-ul e deja deschis
        if (!originalImage) return;

        // Creeaza interfata de pop-up pt scalare
        scaleModal = document.createElement('div');
        scaleModal.className = 'modal-overlay'; // reutilizare clasa din css
        scaleModal.innerHTML = `
            <div class="modal">
                <h3>Scale Image</h3>
                <label> New Width (px): <input type="number" id="scale-width" value="${originalImage.width}" min="1"> </label>
                <label> New Height (px): <input type="number" id="scale-height" value="${originalImage.height}" min="1"> </label>
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    <button id="cancel-scale">Cancel</button>
                    <button id="apply-scale">Apply</button>
                </div>
                <p style="font-size: 0.9em; margin-top: 15px;">The image shown on the screen is always <strong>fitted to your display</strong>.<br>
                The resolution you enter here will only apply<br>
                to the <strong>final downloaded file</strong>.</p>
            </div>
        `;
        document.body.appendChild(scaleModal); //adaugam la html elementul

        const widthInput = document.getElementById('scale-width');
        const heightInput = document.getElementById('scale-height');
        const applyButton = document.getElementById('apply-scale');
        const cancelButton = document.getElementById('cancel-scale');
        //luam referintele catre ce ne intereseaza
        



        // CALCUL AUTOMAT PROPITETATE
        //1. Cand se modifica LATIMEA, calcul automat iNALTime
        const aspectRatio = originalImage.width / originalImage.height;
        widthInput.addEventListener('input', () => {
            const newW = parseInt(widthInput.value);
            if (!isNaN(newW) && newW > 0) {
                // new Height = new Width / aspectRatio
                heightInput.value = Math.round(newW / aspectRatio); // ca sa fie numar intreg
            }
        });

        // Cand se modifica INALTIMEA, calcul AUTOMAT LATIME
        heightInput.addEventListener('input', () => {
            const newH = parseInt(heightInput.value);
            if (!isNaN(newH) && newH > 0) {
                // new Width = new Height * aspectRatio
                widthInput.value = Math.round(newH * aspectRatio); // ca sa fie numar intreg
            }
        });

        const closeModal = () => {
            if (scaleModal) {
                document.body.removeChild(scaleModal);
                scaleModal = null;
            }
            //scoatem popup-ul din html
        };

        cancelButton.addEventListener('click', closeModal);
        applyButton.addEventListener('click', () => {
            const newW = parseInt(widthInput.value)
            const newH = parseInt(heightInput.value)

            if (newW > 0 && newH > 0) {
                applyScale(newW, newH); //aplicam pe imagine noile dimensiuni
                closeModal(); //scoatem popup-ul din html
            } else {
                alert('Both width and height must be positive numbers.');
            }
        });
    };



    //FUNCTIE DE APLICARE SCALE
    const applyScale = (newWidth, newHeight) => {
        if (!originalImage) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Pune imaginea pe noul canvas
        tempCtx.drawImage(
            originalImage,
            0, 0, originalImage.width, originalImage.height, // imaginea veche
            0, 0, newWidth, newHeight // zona in care se pune imaginea veche
        );

        // actualizam imaginea originala cu cea noua.
        originalImage.src = tempCanvas.toDataURL();
        originalImage.width = newWidth;
        originalImage.height = newHeight;
        imageElement.src = originalImage.src;

        updateCanvasToMatchImage(); // realiniaza tot
    };

    //FINAL SCALARE









    // -------------------- 8. SALVARE IMAGINE ------------------------------
    saveButton.addEventListener('click', () => {
        if (!originalImage || !originalImage.src) {
            alert('Please upload an image first!');
            return;
        }
        // Creeaza un element pt descarcare
        const a = document.createElement('a');
        a.href = originalImage.src; 
        a.download = 'edited_image.png'; // cum apare fisierul dupa ce utilizatorul da pe download
        document.body.appendChild(a); //adaugam la html
        a.click(); // practic cand da click pe savebutton, simuleaza automat un click pe acest element nou.
        document.body.removeChild(a); // sterge elementul nou, nemaifiind nevoie de el acum
    });

    // initializare ( asta ar fi folosita doar daca deschizi site-ul si apoi faci fereastra mai mica, inainte sa dai upload la o imagine)
    updateCanvasToMatchImage();
});