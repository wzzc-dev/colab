import packageJson from "./package.json" assert { type: "json" };

export default {
    "app": {
        "name": "co(lab)",
        "identifier": "sh.blackboard.colab",
        "version": packageJson.version
    },
    "build": {
        "bun": {
            "entrypoint": "src/main/index.ts",
            "external": []
        },
        "views": {
           
        },
        "copy": {
            "src/renderers/ivde/index.html": "views/ivde/index.html",
            "assets/custom.editor.worker.js": "views/ivde/custom.editor.worker.js",
            "assets/": "views/assets/",
            "node_modules/@xterm/xterm/css/xterm.css": "views/ivde/xterm.css"
        },
        "mac": {
            "codesign": true,
            "notarize": true,
            "bundleCEF": true,
            "entitlements": {

            }
        }
    },
    "scripts": {
        "postBuild": "./scripts/postBuild.ts"
    },
    "release": {
        "bucketUrl": "https://colab-releases.blackboard.sh/"
    }
}
