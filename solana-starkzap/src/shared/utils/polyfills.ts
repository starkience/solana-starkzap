declare global {
  interface Window {
    fs: any;
  }
  interface Global {
    ReadableStream: any;
    WritableStream: any;
    TransformStream: any;
  }
  interface Process {
    EventEmitter?: any;
  }
}

if (typeof global.structuredClone !== 'function') {
  global.structuredClone = function structuredClone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  };
}

if (typeof global.ReadableStream === 'undefined') {
  class MockReadableStream {
    constructor(_source?: any) {}
    getReader() {
      return {
        read: async () => ({done: true, value: undefined}),
        releaseLock: () => {},
        cancel: async () => {},
      };
    }
  }

  class MockWritableStream {
    constructor(_sink?: any) {}
    getWriter() {
      return {
        write: async () => {},
        close: async () => {},
        abort: async () => {},
        releaseLock: () => {},
      };
    }
  }

  class MockTransformStream {
    readable: any;
    writable: any;
    constructor(_transformer?: any) {
      this.readable = new MockReadableStream();
      this.writable = new MockWritableStream();
    }
  }

  (global as any).ReadableStream = MockReadableStream;
  (global as any).WritableStream = MockWritableStream;
  (global as any).TransformStream = MockTransformStream;
}

// TextEncoder/TextDecoder provided by fast-text-encoding imported in index.js

import {Buffer} from 'buffer';
global.Buffer = Buffer;

Buffer.prototype.subarray = function subarray(
  begin: number | undefined,
  end: number | undefined,
) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype);
  return result as unknown as Buffer;
};

if (typeof global.process === 'undefined') {
  (global as any).process = {
    env: {NODE_ENV: typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production'},
    nextTick: setImmediate,
    version: '',
  };
}
if (typeof global.process.env === 'undefined') {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  (global as any).process.env = {NODE_ENV: isDev ? 'development' : 'production'};
}
if (typeof global.process.nextTick === 'undefined') {
  global.process.nextTick = setImmediate;
}

if (typeof global.process.EventEmitter === 'undefined') {
  class MinimalEventEmitter {
    _events: Record<string, Function[]> = {};
    on(event: string, fn: Function) {
      (this._events[event] = this._events[event] || []).push(fn);
      return this;
    }
    emit(event: string, ...args: any[]) {
      (this._events[event] || []).forEach((fn: Function) => fn(...args));
      return this;
    }
    removeListener(event: string, fn: Function) {
      this._events[event] = (this._events[event] || []).filter((f: Function) => f !== fn);
      return this;
    }
  }
  (global as any).process.EventEmitter = MinimalEventEmitter;
}

const mockFs = {
  readFileSync: () => {
    throw new Error('fs.readFileSync is not supported in React Native');
  },
  writeFileSync: () => {
    throw new Error('fs.writeFileSync is not supported in React Native');
  },
  promises: {
    readFile: async () => {
      throw new Error('fs.promises.readFile is not supported in React Native');
    },
    writeFile: async () => {
      throw new Error('fs.promises.writeFile is not supported in React Native');
    },
  },
};

(global as any).fs = mockFs;

export function ensureBuffer() {
  return global.Buffer !== undefined;
}

export {};
