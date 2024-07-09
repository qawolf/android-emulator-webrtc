/*
 * Copyright 2021 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export function fakeMouseEvent(tp: string, x: any, y: any, props = {}) {
  const event = new MouseEvent(tp, {
    bubbles: true,
    cancelable: true,
    ...props,
  });

  Object.defineProperty(event, "offsetX", { get: () => x });
  Object.defineProperty(event, "offsetY", { get: () => y });
  return event;
}

export function fakeTouchEvent(tp: string, x: any, y: any, force: any, props = {}) {
  const event = new TouchEvent(tp, {
    bubbles: true,
    cancelable: true,
    ...props,
  });

  Object.defineProperty(event, "changedTouches", {
    get: () => [
      { clientX: x, clientY: y, radiusX: 4, radiusY: 4, force: force },
    ],
  });
  return event;
}

export function resize(width: number, height: number) {
  const resizeEvent = document.createEvent("Event");
  resizeEvent.initEvent("resize", true, true);
  (global.window as any).innerWidth = width || (global.window as any).innerWidth;
  (global.window as any).innerHeight = height || (global.window as any).innerHeight;
  global.window.dispatchEvent(resizeEvent);
}
