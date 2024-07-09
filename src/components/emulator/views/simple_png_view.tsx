import PropTypes from "prop-types";
import React, { useState, useEffect } from "react";
import * as Proto from "../../../proto/emulator_controller_pb";
import {EmulatorControllerService} from "../../../proto/emulator_web_client";
import * as emulator_controller_pb from "../../../proto/emulator_controller_pb";

const EmulatorPngView = ({
  emulator,
  onStateChange,
  poll,
  width,
  height,
}: {
  emulator: EmulatorControllerService,
  onStateChange?: (state: string) => void,
  poll?: boolean,
  width?: number,
  height?: number,
}) =>  {
  const [png, setPng] = useState("");
  const [connect, setConnect] = useState("connecting");
  let screenShot: any = null;

  useEffect(() => {
    startStream();
    return () => {
      setConnect("disconnected");
      if (screenShot) {
        screenShot.cancel();
      }
    };
  }, [width, height]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(connect);
    }
  }, [connect]);

  const startStream = () => {
    setConnect("connecting");
    const request = new Proto.ImageFormat();
    if (width) {
      request.setWidth(Math.floor(width));
    }
    if (height) {
      request.setWidth(Math.floor(height));
    }

    if (poll && connect !== "disconnected") {
      emulator.getScreenshot(request, {}, (err: any, response: any) => {
        setConnect("connected");
        setPng("data:image/jpeg;base64," + response.getImage_asB64());
        startStream();
      });
    } else {
      var receivedImage = false;
      screenShot = emulator.streamScreenshot(request);
      screenShot.on("data", (response: emulator_controller_pb.Image) => {
        receivedImage = true;
        setConnect("connected");
        setPng("data:image/jpeg;base64," + response.getImage_asB64());
      });
      screenShot.on("error", (e: any) => {
        console.warn("Screenshot stream broken", e);
        if (receivedImage) {
          setConnect("connecting");
          startStream();
        } else {
          setConnect("disconnected");
        }
      });
    }
  };

  const preventDragHandler = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };


  return (
    <div
      style={{
        display: "block",
        position: "relative",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center",
      }}
      onDragStart={preventDragHandler}
    >
      <img
        src={png}
        width="100%"
        draggable="false"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
};

export default EmulatorPngView;
