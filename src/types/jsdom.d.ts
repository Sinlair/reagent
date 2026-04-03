declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string | undefined });
    window: {
      document: Document;
    };
  }
}
