
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

    public addTitleWithIcon(title: string, icon: string) {
        var item = 
        {
            "type": "ColumnSet",
            "separation": "strong",
            "columns": [
                {
                    "type": "Column",
                    "size": 1,
                    "items": [
                        {
                            "type": "Image",
                            "url": icon
                        }
                    ]
                },
                {
                    "type": "Column",
                    "size": 3,
                    "items": [
                        {
                            "type": "TextBlock",
                            "size": "extraLarge",
                            "color": "dark",
                            "weight": "bolder",
                            "text": title,
                            "horizontalAlignment": "left"
                        }
                    ]
                }
            ]
        }

        this.addItem(item);
    }

    public addItem(item: any) {
        this.m_AdaptiveCard["attachments"][0].content.body.push(item);
    }

    public addFact(title: string, value: string) {
        if (this.m_CurrentFactSet == null) {
            this.m_CurrentFactSet =
            {
                "type": "FactSet",
                "facts": []
            }

            this.addItem(this.m_CurrentFactSet);
        }


        this.m_CurrentFactSet.facts.push(
            {
                "title": title,
                "value": value
            }
        );
    }

    public addActions(a: any, params: any) {

        var b: string = typeof a;

        if (typeof a === "string") {
            let action =            {
                "type": "Action.Submit",
                "title": a,
                "data":
                {
                    "action": a
                }
            };

            for (var p in params) {
                action.data[p] = params[p];
            }
            this.m_AdaptiveCard["attachments"][0].content.actions.push(action);
        } else if (typeof a === "object") {
            for (var item of a) {
                this.addActions(item, params);
            }
        }            
    }

    public getCard(): object
    {
        return this.m_AdaptiveCard;
    }

    private m_AdaptiveCard: object = null;
    private m_CurrentFactSet = null;
}
