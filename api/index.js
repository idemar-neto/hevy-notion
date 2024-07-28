const express = require('express');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const NOTION_API_URL = "https://api.notion.com/v1/pages/";
const NOTION_API_URL_BLOCK = "https://api.notion.com/v1/blocks/";
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const HEVY_API_URL = "https://api.hevyapp.com/v1/workouts?page=1&pageSize=1";
const HEVY_API_KEY = process.env.HEVY_API_KEY;

const notionHeaders = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Connection": "keep-alive",
    "Content-Type": "application/json",
    "Notion-Version": "2022-02-22"
};

const hevyHeaders = {
    "accept": "application/json",
    "api-key": HEVY_API_KEY
};

const app = express();

const readLastWorkoutId = (filePath = 'api/last_workout_id.txt') => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
        return null;
    }
};

const fetchHevyData = async () => {
    try {
        const response = await axios.get(HEVY_API_URL, { headers: hevyHeaders });
        return response.status === 200 ? response.data : null;
    } catch (error) {
        console.error(`Error fetching Hevy data: ${error}`);
        return null;
    }
};

const checkLastId = (data) => {
    for (const workout of data.workouts) {
        if (workout.id === readLastWorkoutId()) {
            return true;
        }
    }
    return false;
};

const saveLastWorkoutId = (workoutId, filePath = 'api/last_workout_id.txt') => {
    fs.writeFileSync(filePath, workoutId);
};

const updateNotion = async (data) => {
    for (const workout of data.workouts) {
        const payload = {
            "properties": {
                "Treino": { "rich_text": [{ "text": { "content": workout.title } }] }
            }
        };

        try {
            await axios.patch(`${NOTION_API_URL}${DATABASE_ID}`, payload, { headers: notionHeaders });

            const blockPayload = payloadTreino(workout);
            await axios.patch(`${NOTION_API_URL_BLOCK}${DATABASE_ID}/children`, blockPayload, { headers: notionHeaders });

            saveLastWorkoutId(workout.id);
        } catch (error) {
            console.error(`Error updating Notion: ${error.response.data}`);
        }
    }
};

const payloadTreino = (treino) => ({
    "children": [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{ "type": "text", "text": { "content": treino.title } }]
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
                            "content": formatWorkoutDescription(treino)
                        }
                    }
                ]
            }
        }
    ]
});

const formatWorkoutDescription = (workoutData) => {
    const description = [];

    for (const exercise of workoutData.exercises) {
        description.push(exercise.title);
        for (const [i, setInfo] of exercise.sets.entries()) {
            let setLine = `Série ${i + 1}: `;

            if (setInfo.weight) {
                setLine += `${setInfo.weight_kg} kg x `;
            }

            setLine += `${setInfo.reps} `;

            if (setInfo.rpe) {
                setLine += `@ ${setInfo.rpe} rpe`;
            }

            if (setInfo.set_type && setInfo.set_type !== "normal") {
                setLine += ` [${setInfo.set_type}]`;
            }

            description.push(setLine);
        }
        description.push("");
    }

    return description.join("\n");
};

app.get('/update-notion', async (req, res) => {
    const hevyData = await fetchHevyData();
    if (hevyData) {
        if (checkLastId(hevyData)) {
            return res.status(500).json({
                "statusCode": 500,
                "body": "Notion not updated with Hevy data due to not having new workouts"
            });
        }
        await updateNotion(hevyData);
        return res.status(200).json({
            "statusCode": 200,
            "body": "Notion updated successfully with Hevy data"
        });
    } else {
        return res.status(500).json({
            "statusCode": 500,
            "body": "Error fetching Hevy data"
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
