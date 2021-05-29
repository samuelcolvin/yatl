function str2ab(str: string): Uint8Array {
  // this will required util.TextEncoder to be added to "global" in node, see tests
  return new TextEncoder().encode(str)
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
