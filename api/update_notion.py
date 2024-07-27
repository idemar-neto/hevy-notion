import os
import requests
from dotenv import load_dotenv

load_dotenv()

NOTION_API_URL = "https://api.notion.com/v1/pages/"
NOTION_API_URL_BLOCK = "https://api.notion.com/v1/blocks/"
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
DATABASE_ID = os.getenv("DATABASE_ID")
HEVY_API_URL = "https://api.hevyapp.com/v1/workouts?page=1&pageSize=1"
HEVY_API_KEY = os.getenv("HEVY_API_KEY")

notion_headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Connection" : "keep-alive",
    "Content-Type": "application/json",
    "Notion-Version": "2022-02-22"
}

hevy_headers = {
    "accept": "application/json",
    "api-key": HEVY_API_KEY
}

def fetch_hevy_data():
    try:
        response = requests.get(HEVY_API_URL, headers=hevy_headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error fetching Hevy data: {response.status_code}")
            return None
    except Exception as e:
        print(f"Exception fetching Hevy data: {e}")
        return None

def update_notion(data):
    for workout in data['workouts']:
        payload = {
            "properties": {
                "Treino": { "rich_text": [{ "text": { "content": workout['title'] } }] }
            }
        }

        response = requests.patch(NOTION_API_URL + DATABASE_ID, headers=notion_headers, json=payload)
        if response.status_code != 200:
            print(f"Error updating Notion: {response.text}")

        payload = payload_treino(workout)

        response = requests.patch(NOTION_API_URL_BLOCK + DATABASE_ID + "/children", headers=notion_headers, json=payload)
        if response.status_code != 200:
            print(f"Error updating Notion: {response.text}")

def handler(request):
    hevy_data = fetch_hevy_data()
    if hevy_data:
        update_notion(hevy_data)
        return {
            "statusCode": 200,
            "body": "Notion updated successfully with Hevy data"
        }
    else:
        return {
            "statusCode": 500,
            "body": "Error fetching Hevy data"
        }
    
def payload_treino(treino):
    return {
        "children": [
		{
			"object": "block",
			"type": "heading_2",
			"heading_2": {
				"rich_text": [{ "type": "text", "text": { "content": treino['title'] } }]
			}
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": format_workout_description(treino)
                        }
                    }
                ]
            }
        }
		]
    }

def format_workout_description(workout_data):
    description = []
        
    for exercise in workout_data['exercises']:
        description.append(exercise['title'])
        for i, set_info in enumerate(exercise['sets']):
            set_line = f"Série {i + 1}: "
            
            if 'weight' in set_info:
                set_line += f"{set_info['weight_kg']} kg x "
            
            set_line += f"{set_info['reps']} "
            
            if 'rpe' in set_info:
                set_line += f"@ {set_info['rpe']} rpe"
            
            if 'set_type' in set_info:
                if set_info['set_type'] != "normal":
                    set_line += f" [{set_info['set_type']}]"
            
            description.append(set_line)
        description.append("")
    
    return "\n".join(description)
