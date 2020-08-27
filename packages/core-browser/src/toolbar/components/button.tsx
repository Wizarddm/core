import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IToolbarActionReactElement, IToolbarActionElementProps, IToolbarActionBtnStyle, IToolbarActionBtnProps, IToolbarActionBtnDelegate, IToolbarActionBtnState } from '../types';
import { useInjectable } from '../../react-hooks';
import { BasicEvent, Disposable, Emitter } from '@ali/ide-core-common';
import * as classnames from 'classnames';
import { AppConfig, ConfigProvider } from '../../react-providers';
import { Button } from '@ali/ide-components';
import { PreferenceService } from '../../preferences';

export const ToolbarActionBtn = (props: IToolbarActionBtnProps & IToolbarActionElementProps) => {
  const context = useInjectable<AppConfig>(AppConfig);
  const ref = React.useRef<HTMLDivElement>();
  const [viewState, setViewState] = React.useState(props.defaultState || 'default');
  const [title, setTitle] = React.useState(undefined);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const { defaultButtonStyle = {} } = props.preferences || {} ;

  const styles: IToolbarActionBtnState = {
    title: props.title,
    iconClass: props.iconClass,
    showTitle: preferenceService.get('toolbar.buttonDisplay') !== 'icon',
    btnStyle: 'button',
    ...defaultButtonStyle,
    ...props.defaultStyle,
    ...(props.styles || {})[viewState] || {},
  };
  if (title) {
    styles.title = title;
  }
  if (styles.btnStyle !== 'button') {
    styles.showTitle = false;
  }

  const delegate = React.useRef<ToolbarBtnDelegate | undefined>();

  React.useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(preferenceService.onSpecificPreferenceChange('toolbar.buttonDisplay', () => {
      forceUpdate();
    }));
    if (ref.current && props.delegate) {
      delegate.current = new ToolbarBtnDelegate(ref.current, props.id, (state, title) => {
        setViewState(state);
        setTitle(title);
      }, () => {
        return viewState;
      }, context, props.popoverComponent);
      props.delegate(delegate.current);
      disposer.addDispose(delegate.current);
      disposer.addDispose({
        dispose: () => {
          props.delegate && props.delegate(undefined);
        },
      });
    }
    return () => disposer.dispose();
  }, [ref.current]);
  const iconContent = !props.inDropDown ? <div className={styles.iconClass + ' kt-toolbar-action-btn-icon'} title={styles.title} style={{
    color: styles.iconForeground,
    backgroundColor: styles.iconBackground,
}}></div> : null;
  const titleContent = (styles.showTitle || props.inDropDown) ? <div className = 'kt-toolbar-action-btn-title' style={{
    color: styles.titleForeground,
    backgroundColor: styles.titleBackground,
  }}>{styles.title}</div> : null;

  const bindings = {
    onClick: (event) => {
      delegate.current && delegate.current._onClick.fire(event);
      if (props.inDropDown) {
        props.closeDropDown();
      }
    },
    onMouseLeave: (event) => {
      delegate.current && delegate.current._onMouseLeave.fire(event);
    },
    onMouseEnter: (event) => {
      delegate.current && delegate.current._onMouseEnter.fire(event);
    },
    style: {
      backgroundColor: styles.background,
    },
  };
  let buttonElement;
  if (props.inDropDown) {
    buttonElement = <div className={classnames({'kt-toolbar-action-btn': true,
    'action-btn-in-dropdown': true})} {...bindings} ref={ref as any}>
      {iconContent}
      {titleContent}
    </div>;
  } else {
    if (styles.btnStyle === 'button' && styles.btnTitleStyle !== 'vertical') {
      buttonElement = <Button type='default' size='small'  {...bindings} >
          {iconContent}
          {titleContent}
        </Button>;
    } else {
      // BtnStyle == inline 或 btnTitleStyle === 'vertical' (类似小程序IDE工具栏） 的模式
      buttonElement =  <div className={ classnames({'kt-toolbar-action-btn': true,
      'kt-toolbar-action-btn-button': styles.btnStyle === 'button',
      'kt-toolbar-action-btn-inline': styles.btnStyle !== 'button',
      'kt-toolbar-action-btn-vertical': styles.btnTitleStyle === 'vertical',
      'kt-toolbar-action-btn-horizontal': styles.btnTitleStyle !== 'vertical'})}
       {...bindings}>
         <Button type='default' size='small'  {...bindings} >
          {iconContent}
        </Button>
        {titleContent}
      </div>;
    }
  }

  return <div className={'kt-toolbar-action-btn-wrapper'} ref={ref as any}>
    { buttonElement }
  </div>;
};

export function createToolbarActionBtn(props: IToolbarActionBtnProps): IToolbarActionReactElement {
  return ( actionProps ) => {
    return <ToolbarActionBtn {...actionProps} {...props} />;
  };
}

export class ToolbarActionBtnClickEvent extends BasicEvent<{
  id: string,
  event: React.MouseEvent<HTMLDivElement, MouseEvent>,
}> {}

const popOverMap = new Map<string, Promise<HTMLDivElement>>();

class ToolbarBtnDelegate implements IToolbarActionBtnDelegate {

  _onClick = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onClick = this._onClick.event;

  _onMouseLeave = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseLeave = this._onClick.event;

  _onMouseEnter = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseEnter = this._onClick.event;

  _onChangeState = new Emitter<{from: string, to: string}>();
  onChangeState = this._onChangeState.event;

  private popOverContainer: HTMLDivElement | undefined;

  private _popOverElement: Promise<HTMLDivElement> | undefined;

  dispose() {
    this._onClick.dispose();
    this._onMouseEnter.dispose();
    this._onMouseLeave.dispose();
    if (this.popOverContainer) {
      this.popOverContainer.remove();
      this.popOverContainer = undefined;
    }
  }

  constructor(private element: HTMLElement, private actionId: string,  private readonly _setState, private _getState, private context: AppConfig, private popoverComponent?: React.FC) {
    if (this.popoverComponent) {
      this._popOverElement = popOverMap.get(actionId);
      this.popOverContainer = document.createElement('div');
      element.append(this.popOverContainer);
    }
  }

  setState(to, title?) {
    const from = this._getState();
    this._setState(to, title);
    this._onChangeState.fire({from, to});
  }

  getRect() {
    return this.element.getBoundingClientRect();
  }

  getPopOverContainer() {
    return this.popOverContainer;
  }

  async showPopOver() {
    if (!this.popOverContainer) {
      return;
    }
    if (!this._popOverElement) {
      this._popOverElement = new Promise((resolve) => {
        const div = document.createElement('div');
        const C = this.popoverComponent!;
        ReactDOM.render(<ConfigProvider value={this.context}>
          <C/>
        </ConfigProvider>, div, () => {
          resolve();
        });
      });
      popOverMap.set(this.actionId, this._popOverElement);
    }
    return this._popOverElement.then((ele) => {
        if (this.popOverContainer && ele.parentElement !== this.popOverContainer) {
          this.popOverContainer.append(ele);
        }
    });
  }

}
