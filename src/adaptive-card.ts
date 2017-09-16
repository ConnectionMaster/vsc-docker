
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

    public addAction() {
        this.m_AdaptiveCard["attachments"][0].content.actions.push(
        {
            "type": "Action.Submit",
            "data":
            {
                "action": "xxx"
            }
        });            
    }

    public getCard(): object
    {
        return this.m_AdaptiveCard;
    }

    private m_AdaptiveCard: object = null;
}
