import { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import './App.scss'

function App() {
  const SERVER_URI = 'http://localhost:4000'
  // MediaRecorder — это интерфейс, предоставляемый MediaStream Recording API, для записи медиа
  let mediaRecorder = null
  // частей записанных данных
  let dataChunks = []

  // генерируем случайное имя пользователя (например, User_1234)
  const username = useRef(`User_${Date.now().toString().slice(-4)}`)
  // возвращает уникальный сокет клиента, используемый для передачи и получения данных от сервера.
  const socketRef = useRef(io(SERVER_URI))
  // ссылки на DOM-элементы video и a для предоставления пользователю возможности просмотра записи и ее скачивания
  const videoRef = useRef()
  const linkRef = useRef()

  // поток видео захваченного экрана
  const [screenStream, setScreenStream] = useState()
  // поток аудио из микрофона
  const [voiceStream, setVoiceStream] = useState()
  // индикатор состояния записи
  const [recording, setRecording] = useState(false)
  // индикатор состояния загрузки
  const [loading, setLoading] = useState(true)

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

  function startRecording() {
    if (screenStream && voiceStream && !mediaRecorder) {
      // обновляем состояние
      setRecording(true)

      // удаляем атрибуты
      videoRef.current.removeAttribute('src')
      linkRef.current.removeAttribute('href')
      linkRef.current.removeAttribute('download')

      // Формируем медиа-поток:
      let mediaStream
      if (voiceStream === 'unavailable') {
        mediaStream = screenStream
      } else {
        mediaStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...voiceStream.getAudioTracks(),
        ])
      }

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
    }
  }

  useEffect(() => {
    // уведомить сервер о подключении нового пользователя, сообщив ему имя пользователя
    socketRef.current.emit('user:connected', username.current)
  }, [])

  useEffect(() => {
    ;(async () => {
      // проверяем поддержку
      if (navigator.mediaDevices.getDisplayMedia) {
        try {
          // получаем поток
          const _screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          })
          // обновляем состояние
          setScreenStream(_screenStream)
        } catch (e) {
          console.error('*** getDisplayMedia', e)
          setLoading(false)
        }
      } else {
        console.warn('*** getDisplayMedia not supported')
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      // проверяем поддержку
      if (navigator.mediaDevices.getUserMedia) {
        // сначала мы должны получить видеопоток
        if (screenStream) {
          try {
            // получаем поток
            const _voiceStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            })
            // обновляем состояние
            setVoiceStream(_voiceStream)
          } catch (e) {
            console.error('*** getUserMedia', e)
            // см. ниже
            setVoiceStream('unavailable')
          } finally {
            setLoading(false)
          }
        }
      } else {
        console.warn('*** getUserMedia not supported')
        setLoading(false)
      }
    })()
  }, [screenStream])

  return (
    <>
      <h1>Screen Recording App</h1>
      <video controls ref={videoRef}></video>
      <a ref={linkRef}>Download</a>
      <button onClick={onClick} disabled={!voiceStream}>
        {!recording ? 'Start' : 'Stop'}
      </button>
    </>
  )
}

export default App
