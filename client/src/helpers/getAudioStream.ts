export const getAudioStream = async (
  screenStream: MediaStream
): Promise<MediaStream> => {
  if (navigator.mediaDevices.getUserMedia && screenStream) {
    const _voiceStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    })

    return _voiceStream
  } else {
    throw new Error('Нет доступа к аудиопотоку')
  }
}
