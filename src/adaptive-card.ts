
export class AdaptiveCard
{
    constructor() {
        this.m_AdaptiveCard = 
        {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
        
                        "type": "AdaptiveCard",
                        "body": [],
                        "actions": []
                    }
                }
            ]
        };
    }

    public addItem(item: any) {
        this.m_AdaptiveCard["attachments"][0].content.body.push(item);
    }

    public addActions(a: any) {

        var b: string = typeof a;

        if (typeof a === "string") {
            this.m_AdaptiveCard["attachments"][0].content.actions.push(
            {
                "type": "Action.Submit",
                "title": a,
                "data":
                {
                    "action": a
                }
            });
        } else if (typeof a === "object") {
            for (var item of a) {
                this.addActions(item);
            }
        }            
    }

    public getCard(): object
    {
        return this.m_AdaptiveCard;
    }

    private m_AdaptiveCard: object = null;
}
