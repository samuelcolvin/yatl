function str2ab(str: string): Uint8Array {
  // should work with both browsers and node, might not be fast but shouldn't be used if performance matters
  const buf = new ArrayBuffer(str.length)
  const array = new Uint8Array(buf)
  const str_length = str.length
  for (let i = 0; i < str_length; i++) {
    array[i] = str.charCodeAt(i)
  }
  return array
}

interface ReadResult {
  done: boolean
  value?: Uint8Array
}

class SyntheticReader {
  private readonly str: string
  private done = false

  constructor(str: string) {
    this.str = str
  }

  async read(): Promise<ReadResult> {
    if (this.done) {
      return {done: true}
    } else {
      this.done = true
      return {done: false, value: str2ab(this.str)}
    }
  }
}

class SyntheticStream {
  private readonly str: string

  constructor(str: string) {
    this.str = str
  }

  getReader(): SyntheticReader {
    return new SyntheticReader(this.str)
  }
}

export function str2stream(str: string): ReadableStream {
  return new SyntheticStream(str) as any
}
