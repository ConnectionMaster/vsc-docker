"use strict";
import * as vscode from "vscode";
import appInsights = require("applicationinsights");

export class AppInsightsClient {
    public static sendEvent(eventName: string, properties?: { [key: string]: string; }): void {
        this._client.trackEvent(eventName, properties);
    }

    private static _client = appInsights.getClient("78bee696-3c3e-4bbc-b9c3-3cde845a6eee");
}
