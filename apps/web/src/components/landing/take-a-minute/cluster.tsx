import { WhatsAppFab } from "../whatsapp";
import { Corner } from "./corner";
import { Pearl } from "./pearl";
import "./cluster.css";

/**
 * The corner of every public page (spec §5.3): the Take a minute pearl above the WhatsApp button.
 * Both buttons render here, on the server, so the WhatsApp code never ships as JS; the behaviour
 * (visibility rules, label peek, loading and opening the experience) is the client island in
 * corner.tsx.
 */
export function FloatingCluster() {
  return <Corner pearl={<Pearl size={34} />} whatsapp={<WhatsAppFab docked />} />;
}
