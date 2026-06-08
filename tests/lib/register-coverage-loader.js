import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/lib/coverage-loader.js", pathToFileURL("./"));
