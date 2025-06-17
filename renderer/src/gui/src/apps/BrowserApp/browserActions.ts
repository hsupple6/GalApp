interface PageInfo {
  title: string;
  url: string;
}

export class BrowserActions {
  constructor(
    private isElectron: boolean,
    private getActiveView: () => any,
    private getIframeRef: () => React.RefObject<HTMLIFrameElement>,
    private getActiveTab: () => { title: string; url: string }
  ) {}

  async getText(selector: string): Promise<string | null> {
    if (this.isElectron) {
      const view = this.getActiveView();
      if (!view) return null;

      const result = await view.webContents.executeJavaScript(`
        (function() {
          const element = document.querySelector('${selector}');
          return element ? element.textContent : null;
        })()
      `);
      return result;
    } else {
      const iframeRef = this.getIframeRef();
      if (!iframeRef.current) return null;

      try {
        const iframe = iframeRef.current;
        const element = iframe.contentDocument?.querySelector(selector);
        return element?.textContent || null;
      } catch (e) {
        console.warn('Cross-origin restrictions prevented reading content');
        return null;
      }
    }
  }

  async click(selector: string): Promise<boolean> {
    if (this.isElectron) {
      const view = this.getActiveView();
      if (!view) return false;

      const result = await view.webContents.executeJavaScript(`
        (function() {
          const element = document.querySelector('${selector}');
          if (element) {
            element.click();
            return true;
          }
          return false;
        })()
      `);
      return result;
    }
    return false;
  }

  async fillForm(selector: string, value: string): Promise<boolean> {
    if (this.isElectron) {
      const view = this.getActiveView();
      if (!view) return false;

      const result = await view.webContents.executeJavaScript(`
        (function() {
          const element = document.querySelector('${selector}');
          if (element) {
            element.value = ${JSON.stringify(value)};
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })()
      `);
      return result;
    }
    return false;
  }

  async getPageInfo(): Promise<PageInfo> {
    if (this.isElectron) {
      const view = this.getActiveView();
      if (!view) return this.getFallbackPageInfo();

      const result = await view.webContents.executeJavaScript(`
        (function() {
          return {
            title: document.title,
            url: window.location.href
          };
        })()
      `);
      return result;
    }
    return this.getFallbackPageInfo();
  }

  async waitForElement(selector: string, timeout = 5000): Promise<boolean> {
    if (this.isElectron) {
      const view = this.getActiveView();
      if (!view) return false;

      const result = await view.webContents.executeJavaScript(`
        (function() {
          return new Promise((resolve) => {
            if (document.querySelector('${selector}')) {
              resolve(true);
              return;
            }

            const observer = new MutationObserver(() => {
              if (document.querySelector('${selector}')) {
                observer.disconnect();
                resolve(true);
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true
            });

            setTimeout(() => {
              observer.disconnect();
              resolve(false);
            }, ${timeout});
          });
        })()
      `);
      return result;
    }
    return false;
  }

  private getFallbackPageInfo(): PageInfo {
    const tab = this.getActiveTab();
    return {
      title: tab.title,
      url: tab.url
    };
  }
} 