export const IWindowService = Symbol('WindowService');

export interface NewWindowOptions {
  readonly external?: boolean;
}

export interface IWindowService {
  /**
   * 打开新的window窗口
   * @param {string} url
   * @param {NewWindowOptions} [options]
   * @returns {(Window | undefined)}
   * @memberof WindowService
   */
  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined;
}
