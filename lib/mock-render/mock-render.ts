import { core } from '@angular/compiler';
import { Component, EventEmitter } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { directiveResolver } from '../common/core.reflect';
import { Type } from '../common/core.types';
import { ngMocks } from '../mock-helper/mock-helper';
import mockServiceHelper from '../mock-service/helper';

import { IMockRenderOptions, MockedComponentFixture } from './types';

function solveOutput(output: any): string {
  if (typeof output === 'function') {
    return '($event)';
  }
  if (output && typeof output === 'object' && output instanceof EventEmitter) {
    return '.emit($event)';
  }
  if (output && typeof output === 'object' && output instanceof Subject) {
    return '.next($event)';
  }
  return '=$event';
}

/**
 * @see https://github.com/ike18t/ng-mocks#mockrender
 */
function MockRender<MComponent, TComponent extends { [key: string]: any }>(
  template: Type<MComponent>,
  params: TComponent,
  detectChanges?: boolean | IMockRenderOptions
): MockedComponentFixture<MComponent, TComponent>;

/**
 * Without params we shouldn't autocomplete any keys of any types.
 *
 * @see https://github.com/ike18t/ng-mocks#mockrender
 */
function MockRender<MComponent extends Record<keyof any, any>>(
  template: Type<MComponent>
): MockedComponentFixture<MComponent>;

/**
 * @see https://github.com/ike18t/ng-mocks#mockrender
 */
function MockRender<MComponent = any, TComponent extends { [key: string]: any } = { [key: string]: any }>(
  template: string,
  params: TComponent,
  detectChanges?: boolean | IMockRenderOptions
): MockedComponentFixture<MComponent, TComponent>;

/**
 * Without params we shouldn't autocomplete any keys of any types.
 *
 * @see https://github.com/ike18t/ng-mocks#mockrender
 */
function MockRender<MComponent = any>(template: string): MockedComponentFixture<MComponent>;

function MockRender<MComponent, TComponent extends { [key: string]: any }>(
  template: string | Type<MComponent>,
  params?: TComponent,
  flags: boolean | IMockRenderOptions = true
): MockedComponentFixture<MComponent, TComponent> {
  const flagsObject: IMockRenderOptions = typeof flags === 'boolean' ? { detectChanges: flags } : flags;
  const isComponent = typeof template !== 'string';
  const noParams = !params;

  let inputs: string[] | undefined = [];
  let outputs: string[] | undefined = [];
  let selector: string | undefined = '';
  let mockedTemplate = '';
  if (typeof template === 'string') {
    mockedTemplate = template;
  } else {
    let meta: core.Directive;
    try {
      meta = directiveResolver.resolve(template);
    } catch (e) {
      /* istanbul ignore next */
      throw new Error('ng-mocks is not in JIT mode and cannot resolve declarations');
    }

    inputs = meta.inputs;
    outputs = meta.outputs;
    selector = meta.selector;

    mockedTemplate += selector ? `<${selector}` : '';
    if (selector && inputs) {
      inputs.forEach((definition: string) => {
        const [property, alias] = definition.split(': ');
        /* istanbul ignore else */
        if (alias && params && typeof params[alias]) {
          mockedTemplate += ` [${alias}]="${alias}"`;
        } else if (property && params && typeof params[property]) {
          mockedTemplate += ` [${property}]="${property}"`;
        } else if (alias && noParams) {
          mockedTemplate += ` [${alias}]="${property}"`;
        } else if (noParams) {
          mockedTemplate += ` [${property}]="${property}"`;
        }
      });
    }
    if (selector && outputs) {
      outputs.forEach((definition: string) => {
        const [property, alias] = definition.split(': ');
        /* istanbul ignore else */
        if (alias && params && typeof params[alias]) {
          mockedTemplate += ` (${alias})="${alias}${solveOutput(params[alias])}"`;
        } else if (property && params && typeof params[property]) {
          mockedTemplate += ` (${property})="${property}${solveOutput(params[property])}"`;
        } else if (alias && noParams) {
          mockedTemplate += ` (${alias})="${property}.emit($event)"`;
        } else if (noParams) {
          mockedTemplate += ` (${property})="${property}.emit($event)"`;
        }
      });
    }
    mockedTemplate += selector ? `></${selector}>` : '';
  }
  const options: Component = {
    providers: flagsObject.providers,
    selector: 'mock-render',
    template: mockedTemplate,
  };

  const component = Component(options)(
    class MockRenderComponent {
      constructor() {
        for (const key of Object.keys(params || {})) {
          (this as any)[key] = (params as any)[key];
        }
        if (noParams && isComponent && inputs && inputs.length) {
          for (const definition of inputs) {
            const [property] = definition.split(': ');
            (this as any)[property] = undefined;
          }
        }
        if (noParams && isComponent && outputs && outputs.length) {
          for (const definition of outputs) {
            const [property] = definition.split(': ');
            (this as any)[property] = new EventEmitter();
          }
        }
      }
    } as Type<TComponent>
  );

  // Soft reset of TestBed.
  ngMocks.flushTestBed();

  // Injection of our template.
  TestBed.configureTestingModule({
    declarations: [component],
  });

  const fixture: any = TestBed.createComponent(component);

  if (flagsObject.detectChanges) {
    fixture.detectChanges();
  }

  fixture.point = fixture.debugElement.children[0];
  if (!fixture.point) {
    fixture.point = fixture.debugElement.childNodes[0];
  }
  if (noParams && typeof template === 'function') {
    const properties = mockServiceHelper.extractPropertiesFromPrototype(template.prototype);
    const exists = Object.getOwnPropertyNames(fixture.componentInstance);
    for (const property of properties) {
      /* istanbul ignore if */
      if (exists.indexOf(property) !== -1) {
        continue;
      }
      Object.defineProperty(fixture.componentInstance, property, {
        get: () => fixture.point.componentInstance[property],
        set: (v: any) => (fixture.point.componentInstance[property] = v),

        configurable: true,
        enumerable: true,
      });
    }
    const methods = mockServiceHelper.extractMethodsFromPrototype(template.prototype);
    for (const method of methods) {
      /* istanbul ignore if */
      if (exists.indexOf(method) !== -1) {
        continue;
      }
      Object.defineProperty(fixture.componentInstance, method, {
        value: (...args: any[]) => fixture.point.componentInstance[method](...args),

        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
  }

  return fixture;
}

export { MockRender };
