from http.server import BaseHTTPRequestHandler
import requests
class handler(BaseHTTPRequestHandler):
 
    def do_GET(self):
        try:
            hevy_headers = {
                "accept": "application/json",
                "api-key": HEVY_API_KEY
            }
            HEVY_API_URL = "https://api.hevyapp.com/v1/workouts?page=1&pageSize=1"
            response = requests.get(HEVY_API_URL, headers=hevy_headers)
            if response.status_code == 200:
                self.send_response(200)
                self.send_header('Content-type','text/plain')
                self.end_headers()
                self.wfile.write(response.json().encode('utf-8'))
            else:
                print(f"Error fetching Hevy data: {response.status_code}")
                return None
        except Exception as e:
            print(f"Exception fetching Hevy data: {e}")
        return
    