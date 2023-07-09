"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNextProxy = void 0;
const EdgeStoreError_1 = __importDefault(require("./libs/errors/EdgeStoreError"));
function createNextProxy({ apiPath, }) {
    return new Proxy({}, {
        get(_, prop) {
            const routeName = prop;
            const routeFunctions = {
                upload: async (params) => {
                    return await uploadFile(params, {
                        routeName: routeName,
                        apiPath,
                    });
                },
            };
            return routeFunctions;
        },
    });
}
exports.createNextProxy = createNextProxy;
async function uploadFile({ file, input, onProgressChange, }, { apiPath, routeName, }) {
    try {
        const res = await fetch(`${apiPath}/request-upload`, {
            method: "POST",
            body: JSON.stringify({
                input,
                fileInfo: {
                    routeName,
                    extension: file.name.split(".").pop(),
                    size: file.size,
                },
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        const json = await res.json();
        if (!json.uploadUrl) {
            throw new EdgeStoreError_1.default("An error occurred");
        }
        // Upload the file to the signed URL and get the progress
        await uploadFileInner(file, json.uploadUrl, onProgressChange);
        return { url: json.accessUrl };
    }
    catch (e) {
        onProgressChange === null || onProgressChange === void 0 ? void 0 : onProgressChange(0);
        throw e;
    }
    finally {
        onProgressChange === null || onProgressChange === void 0 ? void 0 : onProgressChange(100);
    }
}
const uploadFileInner = async (file, uploadUrl, onProgressChange) => {
    const promise = new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", uploadUrl);
        request.addEventListener("loadstart", () => {
            onProgressChange === null || onProgressChange === void 0 ? void 0 : onProgressChange(0);
        });
        request.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                // 2 decimal progress
                const progress = Math.round((e.loaded / e.total) * 10000) / 100;
                onProgressChange === null || onProgressChange === void 0 ? void 0 : onProgressChange(progress);
            }
        });
        request.addEventListener("error", () => {
            reject(new Error("Error uploading file"));
        });
        request.addEventListener("abort", () => {
            reject(new Error("File upload aborted"));
        });
        request.addEventListener("loadend", () => {
            resolve();
        });
        request.send(file);
    });
    return promise;
};
