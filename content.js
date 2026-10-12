window.addEventListener('load', () => {
  const button = document.createElement('button');
  button.textContent = '🔍 Проверить на оригинал';
  button.className = 'avito-checker-btn';
  
  button.addEventListener('click', async () => {
    button.textContent = '⏳ Ищу фото...';
    button.disabled = true;

    const images = document.querySelectorAll('img');
    const imageUrls = new Set(); // Set автоматически удаляет дубликаты
    
    console.log(`--- Начало поиска фото. Всего img на странице: ${images.length} ---`);

    images.forEach((img) => {
      // Берем только картинки реального размера (не иконки и не пустые заглушки)
      if (img.naturalWidth > 150 && img.naturalHeight > 150) {
        let src = img.src || img.dataset.src || img.currentSrc;
        
        // Игнорируем временные blob: и data: ссылки, они не сработают
        if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
          // Хак для Авито: заменяем размер в URL (например, /150x150/) на максимальный /1280x1024/
          let cleanUrl = src.replace(/\/\d+x\d+\//, '/1280x1024/');
          
          // Убираем лишние параметры после знака ?
          cleanUrl = cleanUrl.split('?')[0];
          
          if (cleanUrl.startsWith('http')) {
            imageUrls.add(cleanUrl);
            console.log('✅ Найдено фото:', cleanUrl);
          }
        }
      }
    });

    const finalUrls = Array.from(imageUrls).slice(0, 3); // Берем первые 3 уникальных фото
    console.log('🚀 Итоговые URL для отправки в ИИ:', finalUrls);

    if (finalUrls.length === 0) {
      button.textContent = '🔍 Проверить на оригинал';
      button.disabled = false;
      alert("Не удалось найти подходящие фото. Попробуйте кликнуть на главное фото в галерее, чтобы оно загрузилось в высоком качестве, и нажмите кнопку снова.");
      return;
    }

    button.textContent = '⏳ Анализирую...';
    
    chrome.runtime.sendMessage({ action: "analyzeImages", imageUrls: finalUrls }, (response) => {
      button.textContent = '🔍 Проверить на оригинал';
      button.disabled = false;

      if (response && response.success) {
        showResultPopup(response.data);
      } else {
        alert("Ошибка: " + (response ? response.error : "Неизвестная ошибка"));
        console.error("❌ Детали ошибки от background.js:", response);
      }
    });
  });
  
  document.body.appendChild(button);
});

function showResultPopup(text) {
  const oldPopup = document.getElementById('avito-ai-popup');
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement('div');
  popup.id = 'avito-ai-popup';
  popup.innerHTML = `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999999; max-width: 500px; width: 90%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h3 style="margin-top: 0; color: #00aaff; display: flex; align-items: center; gap: 8px;">🤖 Вердикт ИИ</h3>
      <div style="white-space: pre-wrap; line-height: 1.6; color: #333; max-height: 60vh; overflow-y: auto; font-size: 15px;">${text}</div>
      <button id="close-popup" style="margin-top: 20px; width: 100%; padding: 12px; background: #00aaff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;">Понятно, закрыть</button>
    </div>
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999998;" id="popup-overlay"></div>
  `;
  
  document.body.appendChild(popup);
  
  document.getElementById('close-popup').addEventListener('click', () => popup.remove());
  document.getElementById('popup-overlay').addEventListener('click', () => popup.remove());
}