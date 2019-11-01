export const delay = async (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds))
