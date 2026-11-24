import { AcademyWorld } from "../academy/AcademyWorld";
import { serverBackend } from "../game/gameApi";
import { PlayerGate } from "../game/PlayerGate";

/** Signed-in Learning Academy: same player, progression, and API as the village. */
export default function AcademyPage() {
  return (
    <PlayerGate>
      {({ memberId, canSwitch, onSwitch }) => (
        <AcademyWorld key={memberId} backend={serverBackend(memberId)} canSwitch={canSwitch} onSwitch={onSwitch} />
      )}
    </PlayerGate>
  );
}
