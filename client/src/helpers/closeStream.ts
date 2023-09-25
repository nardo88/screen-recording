export const closeStream = (stream: MediaStream | null) => {
  if (stream) {
    const tracks = stream.getTracks()
    tracks.forEach((track) => track.stop())
  }
}
