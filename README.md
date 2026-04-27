# Dustoff: Carrier Run

A browser-based Three.js prototype for a retro 90s first-person/arcade military helicopter rescue game.

## Run

```bash
npm install
npm run dev
```

## Controls

- Mouse: aim the side gun
- Hold left click: fire the machine gun
- `Q` or `E`: swap gunner side
- `R`: reset after mission complete or failure

## Mission Loop

1. Autopilot departs the carrier.
2. Autopilot flies to the smoke beacon and descends into the extraction zone.
3. Autopilot circles the LZ so the gunner can clear enemy positions from above.
4. Autopilot lands for pickup.
5. Protect five soldiers as they run to board.
6. Autopilot returns to the carrier after boarding.
7. Survive until touchdown to complete the mission.

The prototype uses procedural low-poly geometry only: carrier, helicopter, soldiers, enemies, ocean, urban/desert LZ, smoke beacon, HUD, and raycast gunfire.
