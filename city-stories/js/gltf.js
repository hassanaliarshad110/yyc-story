// One shared model loader for the whole game (one small pool of decoder workers, not one per module)
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/jsm/loaders/DRACOLoader.js';
export const loader = new GLTFLoader();
const draco = new DRACOLoader(); draco.setDecoderPath('./vendor/draco/'); draco.setWorkerLimit(2); loader.setDRACOLoader(draco);
// shaders for new models are compiled ahead (without a pause in the game) through this hook, set by main.js
export const WARM = { fn: null };
export function warm(obj) { if (WARM.fn) WARM.fn(obj); }
