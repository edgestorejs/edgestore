"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EdgeStoreError extends Error {
    constructor(message) {
        super(message);
        this.name = "EdgeStoreError";
    }
}
exports.default = EdgeStoreError;
