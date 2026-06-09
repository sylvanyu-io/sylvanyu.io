/// <reference types="astro/client" />

declare module '*.glsl' {
  const source: string;
  export default source;
}

declare module '*.vert' {
  const source: string;
  export default source;
}

declare module '*.frag' {
  const source: string;
  export default source;
}

declare module '*.fs?raw' {
  const source: string;
  export default source;
}
