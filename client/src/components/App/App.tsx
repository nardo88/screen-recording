import { FC, useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'

import cls from './App.module.scss'
import { getScreenStream } from '@helpers/getScreenStream'
import { getAudioStream } from '@helpers/getAudioStream'

export const App: FC = () => {
  const SERVER_URI = 'http://localhost:4000'
  // MediaRecorder — это интерфейс, предоставляемый MediaStream Recording API, для записи медиа
  let mediaRecorder: MediaRecorder | null = null
  // частей записанных данных
  let dataChunks: BlobPart[] = []

  // генерируем случайное имя пользователя (например, User_1234)
  const username = useRef(`User_${Date.now().toString().slice(-4)}`)
  // возвращает уникальный сокет клиента, используемый для передачи и получения данных от сервера.
  const socketRef = useRef(io(SERVER_URI))
  // ссылки на DOM-элементы video и a для предоставления пользователю возможности просмотра записи и ее скачивания
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null)

  // индикатор состояния записи
  const [recording, setRecording] = useState<boolean>(false)
  // индикатор состояния загрузки
  const [loading, setLoading] = useState<boolean>(true)
  console.log('loading: ', loading)

  const onClick = () => {
    if (!recording) {
      startRecording()
    } else {
      if (mediaRecorder) {
        mediaRecorder.stop()
      }
    }
  }

  function stopRecording() {
    if (videoRef.current && linkRef.current) {
      // обновляем состояние
      setRecording(false)

      // сообщаем серверу о завершении записи
      socketRef.current.emit('screenData:end', username.current)

      // об этом хорошо написано здесь: https://learn.javascript.ru/blob
      // дополнительно:
      const videoBlob = new Blob(dataChunks, {
        type: 'video/webm',
      })
      const videoSrc = URL.createObjectURL(videoBlob)

      // источник видео
      videoRef.current.src = videoSrc
      // ссылка для скачивания файла
      linkRef.current.href = videoSrc
      // название скачиваемого файла
      linkRef.current.download = `${Date.now()}-${username.current}.webm`

      // выполняем сброс
      mediaRecorder = null
      dataChunks = []
    }
  }

  async function startRecording() {
    if (videoRef.current && linkRef.current) {
      try {
        console.log(1)
        const screenStream = await getScreenStream()
        const audioStream = await getAudioStream(screenStream)
        // обновляем состояние
        setRecording(true)

        // удаляем атрибуты
        videoRef.current.removeAttribute('src')
        linkRef.current.removeAttribute('href')
        linkRef.current.removeAttribute('download')

        // Формируем медиа-поток:
        const mediaStream = audioStream
          ? new MediaStream([
              ...screenStream.getVideoTracks(),
              ...audioStream.getAudioTracks(),
            ])
          : screenStream

        // Создаем экземпляр MediaRecorder.

        mediaRecorder = new MediaRecorder(mediaStream)
        mediaRecorder.ondataavailable = ({ data }) => {
          dataChunks.push(data)
          socketRef.current.emit('screenData:start', {
            username: username.current,
            data,
          })
        }

        // По окончанию записи вызывается функция stopRecording:
        mediaRecorder.onstop = stopRecording
        // Метод start принимает количество мс. По истечении указанного времени вызывается событие dataavailable. Данные содержатся в свойстве data.
        mediaRecorder.start(250)
      } catch (e) {
        console.error('*** getDisplayMedia', e)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // уведомить сервер о подключении нового пользователя, сообщив ему имя пользователя
    socketRef.current.emit('user:connected', username.current)
  }, [])

  return (
    <div className={cls.app}>
      <h1>Screen Recording App</h1>
      <video controls ref={videoRef}></video>
      <a ref={linkRef}>Download</a>
      <button onClick={onClick}>{!recording ? 'Start' : 'Stop'}</button>
    </div>
  )
}
