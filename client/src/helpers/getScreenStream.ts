export const getScreenStream = async (): Promise<MediaStream> => {
  if (navigator.mediaDevices.getDisplayMedia) {
    // получаем поток
    const _screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    })

    return _screenStream
  } else {
    throw new Error('нет доступа к видеопотоку')
  }
}
