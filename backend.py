import os
import sys
import json
from openai import OpenAI

print("Python script started, processing input...", flush=True)
# Existing Python script logic here

# Initialize the OpenAI client with your API key
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def ask_gpt(messages, model="gpt-4-1106-preview"):
    try:
        # Create a chat completion request
        response = client.chat.completions.create(
            model=model,
            messages=messages
        )
        # Return the text content of the first completion
        return response.choices[0].message.content
    except Exception as e:
        return {"error": str(e)}

def main():
    # Read the input from stdin
    input_data = sys.stdin.read()
    try:
        # Parse the input data as JSON
        data = json.loads(input_data)

        # Use the "messages" list directly from the input data
        messages = data.get("messages", [])

        # Make the API call with the prepared messages
        response_message = ask_gpt(messages)

        # Print the response message as JSON
        print(json.dumps({"response": response_message}))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": "Invalid input JSON."}), file=sys.stderr)
    except KeyError as e:
        print(json.dumps({"error": f"Missing key in input JSON: {str(e)}"}), file=sys.stderr)

if __name__ == "__main__":
    main()
