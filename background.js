chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeImages") {
    analyzeWithGemini(request.imageUrls)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Обязательно для асинхронного ответа
  }
});

async function analyzeWithGemini(imageUrls) {
  // Ваш ключ (оставлен как есть)
  const API_KEY = "AQ.Ab8RN6L6OewJxpn6-F7QAUF_m7OTX_2zUhSjRuUk3-BoD0RZ1A".trim(); 
  
  // Используем актуальные модели из вашего списка, перебираем их по очереди
  const modelsToTry = [
    "gemini-2.5-flash",      // Стабильная, быстрая, отлично работает с изображениями
    "gemini-3.1-flash-lite", // Самая свежая и быстрая
    "gemini-2.5-pro"         // Более умная, если первые две вдруг откажут
  ];

  // Берем первые 3 фотографии для более точного анализа
  const urlsToAnalyze = imageUrls.slice(0, 3);
  const imageParts = [];

  for (const url of urlsToAnalyze) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      
      imageParts.push({
        inlineData: {
          mimeType: blob.type || 'image/jpeg',
          data: base64
        }
      });
    } catch (e) {
      console.warn("⚠️ Не удалось загрузить изображение:", url, e);
    }
  }

  if (imageParts.length === 0) {
    throw new Error("Не удалось загрузить ни одного изображения для анализа. Проверьте консоль.");
  }

  imageParts.push({
    text: "Проанализируй эти фотографии одежды с Авито. Помоги определить, оригинал это или подделка (паль). Обрати внимание на бирки, швы, качество принтов, фурнитуру, лейблы и общее качество пошива. Напиши краткий вердикт: 1) Что настораживает, 2) Что говорит в пользу оригинала, 3) Итоговый вывод (Оригинал / Скорее всего паль / Нужны дополнительные фото)."
  });

  let lastError = "";
  
  // Перебираем модели, пока одна из них не сработает
  for (const model of modelsToTry) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    console.log(`🔄 Пробуем модель: ${model}`);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: imageParts }] })
      });

      const data = await response.json();
      
      // Проверяем, есть ли ошибка в ответе Google
      if (data.error) {
        lastError = data.error.message;
        console.warn(`❌ Модель ${model} не подошла:`, lastError);
        continue; // Пробуем следующую модель из списка
      }
      
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
        console.log(`✅ Успех с моделью: ${model}`);
        return data.candidates[0].content.parts[0].text;
      } else {
        lastError = "Неожиданный формат ответа: " + JSON.stringify(data);
        continue;
      }
    } catch (e) {
      lastError = e.message;
      console.warn(`❌ Ошибка сети для модели ${model}:`, lastError);
      continue;
    }
  }

  // Если ни одна модель не сработала
  throw new Error("Ни одна модель не ответила. Последняя ошибка: " + lastError);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // Убираем префикс data:image/...
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}