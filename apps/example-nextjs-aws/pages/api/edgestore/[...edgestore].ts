import EdgeStore from "@edge-store/react/next";
import { AWSProvider } from "@edge-store/react/providers";

export default EdgeStore({
  provider: AWSProvider(),
});
