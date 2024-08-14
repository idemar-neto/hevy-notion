const express = require('express');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const NOTION_API_URL = "https://api.notion.com/v1/pages/";
const NOTION_API_URL_BLOCK = "https://api.notion.com/v1/blocks/";
const NOTION_API_URL_DATABASE = "https://api.notion.com/v1/database/";
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

const fetchHevyData = async () => {
    try {
        const response = await axios.get(HEVY_API_URL, { headers: hevyHeaders });
        return response.status === 200 ? response.data : null;
    } catch (error) {
        console.error(`Error fetching Hevy data: ${error}`);
        return null;
    }
};

const fetchDatabasePages = async () => {
    const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;
    try {
        const response = await axios.post(url, {}, { headers: notionHeaders });
        if (response.status === 200) {
            return response.data.results;
        } else {
            console.error(`Error fetching database pages: ${response.status}`);
            return [];
        }
    } catch (error) {
        console.error(`Exception fetching database pages: ${error}`);
        return [];
    }
};

const getLastPage = (pages) => {
    if (pages.length === 0) {
        return null;
    }
    return pages.reduce((latest, page) => {
        const latestCreatedTime = new Date(latest.created_time).getTime();
        const currentCreatedTime = new Date(page.created_time).getTime();
        return currentCreatedTime > latestCreatedTime ? page : latest;
    });
};

const updateNotion = async (data) => {
    if (!data || !data.workouts) {
        console.error('No valid workout data to update Notion');
        return;
    }
    
    const pages = await fetchDatabasePages();
    const lastPage = getLastPage(pages);

    if (!lastPage) {
        console.error('No pages found in the database');
        return false;
    }

    if(new Date(lastPage.created_time).toDateString() !== new Date().toDateString()) {
        console.error('No pages found in this date');
        return false;
    }

    if(lastPage.properties.Treino.rich_text.length > 0){
        console.error('This day already has a workout saved');
        return false;
    }

    for (const workout of data.workouts) {
        const payload = {
            "properties": {
                "Treino": { "rich_text": [{ "text": { "content": workout.title } }] }
            }
        };

        try {
            let response = await axios.patch(`${NOTION_API_URL}${lastPage.id}`, payload, { headers: notionHeaders });

            const blockPayload = payloadTreino(workout);
            response = await axios.patch(`${NOTION_API_URL_BLOCK}${lastPage.id}/children`, blockPayload, { headers: notionHeaders });

            // saveLastWorkoutId(workout.id);

            return true
        } catch (error) {
            console.error(`Error updating Notion: ${error.response ? error.response.data : error.message}`);
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

            if (setInfo.weight_kg) {
                setLine += `${setInfo.weight_kg} kg x `;
            }

            if (setInfo.reps){
                setLine += `${setInfo.reps} `;
            }
            
            if (setInfo.weight_kg == null && setInfo.reps == null && setInfo.duration_seconds) {
                setLine += `${Math.floor(setInfo.duration_seconds / 60)}:${String(Math.floor(setInfo.duration_seconds % 60)).padStart(2, '0')} `;
            }


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

app.get('/update_notion', async (req, res) => {
    const hevyData = await fetchHevyData();
    if (hevyData) {
        // if (checkLastId(hevyData)) {
        //     return res.status(500).json({
        //         "statusCode": 500,
        //         "body": "Notion not updated with Hevy data due to not having new workouts"
        //     });
        // }
        const bool = await updateNotion(hevyData);
        return bool ? res.status(200).json({
            "statusCode": 200,
            "body": "Notion updated successfully with Hevy data"
        }) : res.status(500).json({
            "statusCode": 500,
            "body": "Error"
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
