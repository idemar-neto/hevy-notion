import os
from update_notion import fetch_hevy_data, update_notion

def test_integration():
    hevy_data = fetch_hevy_data()
    if hevy_data:
        update_notion(hevy_data)
        print("Notion updated successfully with Hevy data")
    else:
        print("Error fetching Hevy data")

if __name__ == "__main__":
    os.environ['NOTION_TOKEN'] = 'seu_token_de_acesso'
    os.environ['DATABASE_ID'] = 'seu_id_do_database'
    os.environ['HEVY_API_KEY'] = '36a430aa-fd22-4153-8789-8aad8ce0306a'
    test_integration()
