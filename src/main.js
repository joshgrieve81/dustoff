import "./styles.css";
import { DustoffGame } from "./systems/DustoffGame.js";

const root = document.getElementById("app");
const game = new DustoffGame(root);
game.start();
