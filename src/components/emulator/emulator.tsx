/*
 * Copyright 2019 The Android Open Source Project
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
import React, {Component} from "react";
import EmulatorPngView from "./views/simple_png_view.js";
import EmulatorWebrtcView from "./views/webrtc_view.js";
import withMouseKeyHandler from "./views/event_handler.js";
import JsepProtocol from "./net/jsep_protocol_driver.js";
import * as Proto from "../../proto/emulator_controller_pb.js";
import {
    RtcService,
    EmulatorControllerService, Authenticator, NopAuthenticator,
} from "../../proto/emulator_web_client";

const PngView = withMouseKeyHandler(EmulatorPngView);
const RtcView = withMouseKeyHandler(EmulatorWebrtcView);

export type EmulatorProps = {
    /** gRPC Endpoint where we can reach the emulator. */
    uri: string;
    /** The authentication service to use, or null for no authentication. */
    auth?: Authenticator;
    /** True if the audio should be disabled. This is only relevant when using the webrtc engine. */
    muted?: boolean;
    /** Called upon state change, one of ["connecting", "connected", "disconnected"] */
    onStateChange?: (state: string) => void;
    /** Called when the audio becomes (un)available. True if audio is available, false otherwise. */
    onAudioStateChange?: (audio: boolean) => void;
    /** The width of the component */
    width?: number;
    /** The height of the component */
    height?: number;
    /** The underlying view used to display the emulator, one of ["webrtc", "png"] */
    view?: "webrtc" | "png";
    /** A [GeolocationCoordinates](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates) like object indicating where the device is. */
    gps?: any;
    /** True if polling should be used, only set this to true if you are using the go webgrpc proxy. */
    poll?: boolean;
    /** Callback that will be invoked in case of gRPC errors. */
    onError?: (e: any) => void;
}

/**
 * A React component that displays a remote android emulator.
 *
 * The emulator will mount a png or webrtc view component to display the current state
 * of the emulator. It will translate mouse events on this component and send them
 * to the actual emulator.
 *
 * #### Authentication Service
 *
 * The authentication service should implement the following methods:
 *
 * - `authHeader()` which must return a set of headers that should be send along with a request.
 * - `unauthorized()` a function that gets called when a 401 was received.
 *
 * #### Type of view
 *
 * You usually want this to be webrtc as this will make use of the efficient
 * webrtc implementation. The png view will request screenshots, which are
 * very slow, and require the envoy proxy. You should not use this for remote emulators.
 *
 * Note that chrome will not autoplay the video if it is not muted and no interaction
 * with the page has taken place. See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes.
 *
 * #### Pressing hardware buttons
 *
 * This component has a method `sendKey` that sends a key to the emulator.
 * You can use this to send physical button events to the emulator for example:
 *
 * "AudioVolumeDown" - 	Decreases the audio volume.
 * "AudioVolumeUp"   -	Increases the audio volume.
 * "Power"	         -  The Power button or key, turn off the device.
 * "AppSwitch"       -  Should bring up the application switcher dialog.
 * "GoHome"          -  Go to the home screen.
 * "GoBack"          -  Open the previous screen you were looking at.
 *
 */
class Emulator extends Component {
  emulator: EmulatorControllerService;
  rtc: RtcService;
  jsep: JsepProtocol;
  view: any;
  props: EmulatorProps;
  finalProps: {
    /** gRPC Endpoint where we can reach the emulator. */
    uri: string;
    /** The authentication service to use, or null for no authentication. */
    auth: Authenticator;
    /** True if the audio should be disabled. This is only relevant when using the webrtc engine. */
    muted: boolean;
    /** Called upon state change, one of ["connecting", "connected", "disconnected"] */
    onStateChange: (state: string) => void;
    /** Called when the audio becomes (un)available. True if audio is available, false otherwise. */
    onAudioStateChange: (audio: boolean) => void;
    /** The width of the component */
    width: number;
    /** The height of the component */
    height: number;
    /** The underlying view used to display the emulator, one of ["webrtc", "png"] */
    view: "webrtc" | "png";
    /** A [GeolocationCoordinates](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates) like object indicating where the device is. */
    gps: any;
    /** True if polling should be used, only set this to true if you are using the go webgrpc proxy. */
    poll: boolean;
    /** Callback that will be invoked in case of gRPC errors. */
    onError: (e: any) => void;
  };

  state = {
    audio: false,
  };

  constructor(props: EmulatorProps) {
      super(props);
      this.props = props;
    this.finalProps = {
      uri: props.uri,
      auth: props.auth ?? new NopAuthenticator(),
      poll: props.poll ?? false,
      muted: props.muted ?? true,
      onError: props.onError ?? ((e) => {
          console.error(e);
      }),
      onAudioStateChange: props.onAudioStateChange ?? ((s) => {
          console.debug("emulator audio: " + s);
      }),
      onStateChange: props.onStateChange ?? ((s) => {
          console.debug("emulator state: " + s);
      }),
      width: props.width ?? 1080,
      height: props.height ?? 1920,
      view: props.view ?? "webrtc",
      gps: props.gps,
    }
    const { uri, auth, poll, onError } = this.finalProps;
    this.emulator = new EmulatorControllerService(uri, auth, onError);
    this.rtc = new RtcService(uri, auth, onError);
    this.jsep = new JsepProtocol(this.emulator, this.rtc, poll);
    this.view = React.createRef();
  }

  static getDerivedStateFromProps(nextProps: EmulatorProps, prevState: EmulatorProps) {
    if (nextProps.view === "png")
      return {
        audio: false,
      };

    return prevState;
  }

  componentDidMount = () => {
    this.updateLocation();
  };

  componentDidUpdate = (prevProps: EmulatorProps) => {
    if (prevProps.gps !== this.finalProps.gps) {
      this.updateLocation();
    }
  };

  updateLocation = () => {
    const { gps } = this.finalProps;
    if (typeof gps === "undefined") {
      return;
    }

    const state = new Proto.GpsState();
    state.setLatitude(gps.latitude);
    state.setLongitude(gps.longitude);
    state.setAltitude(gps.altitude);
    state.setBearing(gps.heading);
    state.setSpeed(gps.speed);
    this.emulator.setGps(state, null);
  };

  /**
   * Sends the given key to the emulator.
   *
   * You can use this to send physical hardware events to the emulator for example:
   *
   * "AudioVolumeDown" - 	Decreases the audio volume.
   * "AudioVolumeUp"   -	Increases the audio volume.
   * "Power"	         -  The Power button or key, turn off the device.
   * "AppSwitch"       -  Should bring up the application switcher dialog.
   * "GoHome"          -  Go to the home screen.
   * "GoBack"          -  Open the previous screen you were looking at.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values for
   * a list of valid values you can send as well.
   */
  sendKey = async (key: string) => {
    const request = new Proto.KeyboardEvent();
    request.setEventtype(Proto.KeyboardEvent.KeyEventType.KEYPRESS);
    request.setKey(key);
    await this.jsep.send("keyboard", request);
  };

  _onAudioStateChange = (s: boolean) => {
    const { onAudioStateChange } = this.finalProps;
    this.setState({ audio: s }, () => {
      onAudioStateChange!(s);
    });
  };

  render(): React.JSX.Element {
    const { width, height, view, poll, muted, onStateChange, onError } =
      this.finalProps;

    console.log(`render ${width}x${height}`);
    return (
        view === "webrtc" ? <RtcView
            ref={this.view}
            emulator={this.emulator}
            jsep={this.jsep}
            onStateChange={onStateChange}
            poll={poll}
            muted={muted}
            onError={onError}
            onAudioStateChange={this._onAudioStateChange}
            // width and height are not used in RtcView but needed to satisfy the type requirement of withMouseKeyHandler.
            width={width}
            height={height}
        /> : <PngView
            ref={this.view}
            width={width}
            height={height}
            emulator={this.emulator}
            jsep={this.jsep}
            onStateChange={onStateChange}
            poll={poll}
            muted={muted}
            onError={onError}
            onAudioStateChange={this._onAudioStateChange}
        />
    )
  }
}

export default Emulator;
