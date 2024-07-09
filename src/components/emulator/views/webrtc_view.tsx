/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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
import React, { RefObject, useEffect, useRef, useState } from "react";
import JsepProtocol from "../net/jsep_protocol_driver.js";

const EmulatorWebrtcView = ({
  jsep,
  onStateChange,
  onAudioStateChange,
  muted,
  onError,
}: {
  jsep: JsepProtocol;
  onStateChange: (state: string) => void;
  onAudioStateChange: (state: boolean) => void;
  muted: boolean;
  onError: (error: any) => void;
}) => {
  const [audio, setAudio] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connect, setConnect] = useState("connecting");

  useEffect(() => {
    if (onStateChange) {
      onStateChange(connect);
    }
  }, [connect]);

  useEffect(() => {
    if (onAudioStateChange) {
      onAudioStateChange(audio);
    }
  }, [audio]);

  const onDisconnect = () => {
    setConnect("disconnected");
    setAudio(false);
  };

  const onConnect = (track: MediaStreamTrack) => {
    setConnect("connected");
    const video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }

    if (!video.srcObject) {
      video.srcObject = new MediaStream();
    }
    (video.srcObject as MediaStream).addTrack(track);
    if (track.kind === "audio") {
      setAudio(true);
    }
  };

  const safePlay = () => {
    const video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }

    const possiblePromise = video.play();
    if (possiblePromise) {
      possiblePromise
        .then((_) => {
          console.debug("Automatic playback started!");
        })
        .catch((error) => {
          // Notify listeners that we cannot start.
          onError(error);
        });
    }
  };

  const onCanPlay = () => {
    safePlay();
  };

  const onContextMenu = (e: React.MouseEvent<HTMLVideoElement, MouseEvent>) => {
    e.preventDefault();
  };

  useEffect(() => {
    jsep.on("connected", onConnect);
    jsep.on("disconnected", onDisconnect);
    jsep.startStream();

    setConnect("connecting");

    return () => {
      jsep.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      style={{
        display: "block",
        position: "relative",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center",
      }}
      muted={muted}
      onContextMenu={onContextMenu}
      onCanPlay={onCanPlay}
    />
  );
};

export default EmulatorWebrtcView;
