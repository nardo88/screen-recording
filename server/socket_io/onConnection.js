import { saveData } from "../utils/saveData.js";

const socketByUser = {};
const dataChunks = {};

export const onConnection = (socket) => {
  // Функция для обработки подключения принимает сокет.
  // Обрабатываем подключение нового пользователя посредством записи имени пользователя в поисковую таблицу.
  socket.on("user:connected", (username) => {
    if (!socketByUser[socket.id]) {
      socketByUser[socket.id] = username;
    }
  });

  // Обрабатываем получение от клиента частей записанных данных. dataChunks — это также поисковая таблица имя пользователя - массив данных.
  socket.on("screenData:start", ({ data, username }) => {
    if (dataChunks[username]) {
      dataChunks[username].push(data);
    } else {
      dataChunks[username] = [data];
    }
  });

  // Обрабатываем завершение записи.
  socket.on("screenData:end", (username) => {
    if (dataChunks[username] && dataChunks[username].length) {
      // вызываем функцию для записи данных,
      // передавая ей массив данных и имя пользователя
      saveData(dataChunks[username], username);
      dataChunks[username] = [];
    }
  });

  // Аналогичным образом обрабатываем отключение клиента на случай закрытия вкладки браузера во время записи — в этом случае событие screenData:end отправлено не будет. В худшем случае мы потеряем 250 мс видео
  socket.on("disconnect", () => {
    const username = socketByUser[socket.id];
    if (dataChunks[username] && dataChunks[username].length) {
      saveData(dataChunks[username], username);
      dataChunks[username] = [];
    }
  });
};
