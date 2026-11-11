
document.addEventListener('DOMContentLoaded', () => {

    // =====================================================
    // 1. CONTADOR DE CARACTERES
    // =====================================================

    const textarea = document.getElementById('mensaje');
    const charCount = document.getElementById('charCount');
    const charRemaining = document.getElementById('charRemaining');
    const maxChars = 5000;

    function updateCounter() {
        if (!textarea || !charCount) return;

        const length = textarea.value.length;
        const remaining = Math.max(0, maxChars - length);

        charCount.textContent = length.toLocaleString('es-DO');

        if (charRemaining) {
            charRemaining.textContent =
                remaining.toLocaleString('es-DO') + ' disponibles';
        }

        if (length >= maxChars) {
            charCount.className = 'font-bold text-rose-600';

            if (charRemaining) {
                charRemaining.className = 'font-mono text-rose-600 font-bold';
            }
        } else if (length >= 4500) {
            charCount.className = 'font-bold text-amber-600';

            if (charRemaining) {
                charRemaining.className = 'font-mono text-amber-600';
            }
        } else {
            charCount.className = 'font-medium text-slate-700';

            if (charRemaining) {
                charRemaining.className = 'font-mono text-slate-400';
            }
        }
    }

    if (textarea) {
        textarea.addEventListener('input', updateCounter);
        updateCounter();
    }


    // =====================================================
    // 2. SELECCIÓN Y PREVISUALIZACIÓN DE IMÁGENES
    // =====================================================

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('imagenes');
    const previewContainer = document.getElementById('previewContainer');

    let selectedFiles = [];

    if (dropzone && fileInput && previewContainer) {

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                event.stopPropagation();

                dropzone.classList.add(
                    'border-indigo-600',
                    'bg-indigo-50/40'
                );
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                event.stopPropagation();

                dropzone.classList.remove(
                    'border-indigo-600',
                    'bg-indigo-50/40'
                );
            });
        });

        dropzone.addEventListener('drop', event => {
            const files = event.dataTransfer?.files;

            if (files?.length) {
                addFiles(files);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files?.length) {
                addFiles(fileInput.files);
            }
        });

        function addFiles(newFiles) {
            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp'
            ];

            for (const file of newFiles) {

                if (!allowedTypes.includes(file.type)) {
                    alert(`El archivo "${file.name}" no es un formato soportado.`);
                    continue;
                }

                if (file.size > 5 * 1024 * 1024) {
                    alert(`La imagen "${file.name}" supera el límite de 5MB.`);
                    continue;
                }

                if (selectedFiles.length >= 5) {
                    alert('Solo puede adjuntar un máximo de 5 imágenes.');
                    break;
                }

                selectedFiles.push(file);
            }

            syncFileInput();
            renderPreviews();
        }

        function syncFileInput() {
            const dataTransfer = new DataTransfer();

            selectedFiles.forEach(file => {
                dataTransfer.items.add(file);
            });

            fileInput.files = dataTransfer.files;
        }

        function renderPreviews() {
            previewContainer.innerHTML = '';

            if (selectedFiles.length === 0) {
                previewContainer.classList.add('hidden');
                return;
            }

            previewContainer.classList.remove('hidden');

            selectedFiles.forEach((file, index) => {

                const card = document.createElement('div');

                card.className =
                    'relative group bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex flex-col items-center';

                const img = document.createElement('img');

                img.src = URL.createObjectURL(file);
                img.alt = file.name;

                img.className =
                    'w-full h-20 object-cover rounded-lg mb-1.5';

                const nameP = document.createElement('p');

                nameP.className =
                    'text-[10px] text-slate-700 font-medium truncate w-full px-1 text-center';

                nameP.textContent = file.name;

                const sizeP = document.createElement('p');

                sizeP.className =
                    'text-[9px] text-slate-400 font-mono';

                sizeP.textContent =
                    (file.size / 1024).toFixed(0) + ' KB';

                const removeBtn = document.createElement('button');

                removeBtn.type = 'button';

                removeBtn.className =
                    'absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md transition';

                removeBtn.textContent = '×';
                removeBtn.title = 'Quitar foto';

                removeBtn.addEventListener('click', event => {
                    event.stopPropagation();

                    URL.revokeObjectURL(img.src);

                    selectedFiles.splice(index, 1);

                    syncFileInput();
                    renderPreviews();
                });

                card.appendChild(img);
                card.appendChild(nameP);
                card.appendChild(sizeP);
                card.appendChild(removeBtn);

                previewContainer.appendChild(card);
            });
        }
    }


    // =====================================================
    // 3. COPIAR IMAGEN AL PORTAPAPELES
    // =====================================================

    document.addEventListener('click', async event => {

        const button = event.target.closest('.btn-copy-image');

        if (!button) return;

        const imageUrl = button.dataset.imageUrl;

        if (!imageUrl) return;

        const originalText = button.querySelector('span')?.textContent || 'Copiar imagen';
        const textElement = button.querySelector('span');

        try {
            if (textElement) {
                textElement.textContent = 'Copiando...';
            }

            const response = await fetch(imageUrl);

            if (!response.ok) {
                throw new Error('No se pudo obtener la imagen.');
            }

            const blob = await response.blob();

            let finalBlob = blob;

            if (blob.type !== 'image/png') {

                const image = new Image();

                image.src = URL.createObjectURL(blob);

                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = reject;
                });

                const canvas = document.createElement('canvas');

                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;

                const context = canvas.getContext('2d');

                context.drawImage(image, 0, 0);

                finalBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });

                URL.revokeObjectURL(image.src);
            }

            if (!finalBlob) {
                throw new Error('No se pudo convertir la imagen.');
            }

            if (!navigator.clipboard?.write || !window.ClipboardItem) {
                throw new Error('El navegador no permite copiar imágenes.');
            }

            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': finalBlob
                })
            ]);

            if (textElement) {
                textElement.textContent = '¡Copiada!';
            }

        } catch (error) {

            console.error('[Clipboard Error]', error);

            if (textElement) {
                textElement.textContent = 'No se pudo copiar';
            }

            window.open(imageUrl, '_blank', 'noopener,noreferrer');

        } finally {

            setTimeout(() => {
                if (textElement) {
                    textElement.textContent = originalText;
                }
            }, 2500);
        }
    });

});
