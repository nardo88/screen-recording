import { FC, useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'

import cls from './App.module.scss'
import { getScreenStream } from '@helpers/getScreenStream'
import { getAudioStream } from '@helpers/getAudioStream'
import { closeStream } from '@helpers/closeStream'

export const App: FC = () => {
  const SERVER_URI = 'http://localhost:4000'

  // частей записанных данных
  const dataChunks: BlobPart[] = []

  // генерируем случайное имя пользователя (например, User_1234)
  const username = useRef(`User_${Date.now().toString().slice(-4)}`)
  // возвращает уникальный сокет клиента, используемый для передачи и получения данных от сервера.
  const socketRef = useRef(io(SERVER_URI))
  // ссылки на DOM-элементы video и a для предоставления пользователю возможности просмотра записи и ее скачивания
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  // MediaRecorder — это интерфейс, предоставляемый MediaStream Recording API, для записи медиа
  const mediaRecorder = useRef<MediaRecorder | null>(null)

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)

  // индикатор состояния записи
  const [recording, setRecording] = useState<boolean>(false)

  function stopRecording() {
    if (videoRef.current && linkRef.current && mediaRecorder.current) {
      // обновляем состояние
      setRecording(false)

      // сообщаем серверу о завершении записи
      socketRef.current.emit('screenData:end', username.current)

      closeStream(videoStream)
      setVideoStream(null)
      closeStream(audioStream)
      setAudioStream(null)

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
      linkRef.current.classList.add('active-link')
      // выполняем сброс
      mediaRecorder.current = null
      dataChunks.length = 0
    }
  }

  async function startRecording() {
    if (videoRef.current && linkRef.current) {
      try {
        const screenStream = await getScreenStream()
        setVideoStream(screenStream)
        const audioStream = await getAudioStream(screenStream)
        setAudioStream(audioStream)
        // обновляем состояние
        setRecording(true)

        // удаляем атрибуты
        videoRef.current.removeAttribute('src')
        linkRef.current.removeAttribute('href')
        linkRef.current.removeAttribute('download')
        linkRef.current.classList.remove('active-link')

        // Формируем медиа-поток:
        const mediaStream = audioStream
          ? new MediaStream([
              ...screenStream.getVideoTracks(),
              ...audioStream.getAudioTracks(),
            ])
          : screenStream

        // Создаем экземпляр MediaRecorder.

        mediaRecorder.current = new MediaRecorder(mediaStream)
        // mediaRecorder.ondataavailable = ({ data }) => {}

        mediaRecorder.current.addEventListener('dataavailable', ({ data }) => {
          dataChunks.push(data)
          socketRef.current.emit('screenData:start', {
            username: username.current,
            data,
          })
        })

        // По окончанию записи вызывается функция stopRecording:
        mediaRecorder.current.onstop = stopRecording
        // Метод start принимает количество мс. По истечении указанного времени вызывается событие dataavailable. Данные содержатся в свойстве data.
        mediaRecorder.current.start(250)
      } catch (e) {
        console.error('*** getDisplayMedia', e)
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
      <video className={cls.video} controls ref={videoRef}></video>
      <a className={cls.link} ref={linkRef}>
        Download
      </a>
      {recording ? (
        <button onClick={() => mediaRecorder.current?.stop()}>Stop</button>
      ) : (
        <button onClick={startRecording}>Start</button>
      )}
    </div>
  )
}
