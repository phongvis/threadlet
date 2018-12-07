from flask import Flask, request
from flask_cors import CORS

import json
import numpy as np
import logging

app = Flask(__name__)
CORS(app)

filename = 'data/threads-100_revV2.json'
all_threads = None # Store all threads from the local data file
if not all_threads:
    with open(filename, 'r') as f:
        all_threads = json.load(f)

model_name = '' # Initially, no model is loaded



# model endpoint
@app.route("/model")
def model():
    # Modelling
    data = request.args.get('data', '')
    labelled_threads = json.loads(data) # This is a list of dictionary { threadId, classId }
    app.logger.info('testing info log')
    app.logger.info('-----------------')
    app.logger.info(labelled_threads)
    predicted_all_threads = build_dummy_model(labelled_threads) # To be replaced by proper active learning modelling
    app.logger.info('----------------- Predicted --------------')
    app.logger.info(predicted_all_threads)
    # Getting recommendations
    recommend = request.args.get('rec', '') == 'true'
    recommended_samples = [] # Return empty list if no recommendation required
    if recommend:
        recommended_samples = get_dummy_recommended_samples() # To be replaced by proper active learning modelling

    # Prepare returning object (note that there are some `tolist()` to make object JSON serialisable)
    return_object = {
        'classLookup': predicted_all_threads,
        'samples': recommended_samples
    }

    return json.dumps(return_object)

def build_dummy_model(labelled_threads):
    "Return random labels for the entire dataset as a dictionary { threadId: classId }."
    classes = get_available_classes(labelled_threads)
    labels = np.random.choice(classes, size=len(all_threads), replace=True).tolist()
    labelled_all_threads = { t['threadId']: labels[i] for i, t in enumerate(all_threads) }
    return labelled_all_threads

def get_available_classes(labelled_threads):
    "Return a list of classes appeared in the threads."
    return list(set(t['classId'] for t in labelled_threads))

def get_dummy_recommended_samples():
    "Randomly return 50 thread IDs."
    all_thread_ids = [t['threadId'] for t in all_threads]
    return np.random.permutation(all_thread_ids)[:50].tolist()

# save endpoint
@app.route("/save")
def save():
    model_name = request.args.get('name', '') # Use this to save the model
    print(model_name)
    return ''

# load endpoint
@app.route("/load")
def load():
    model_name = request.args.get('name', '') # Use this to load the model
    print(model_name)
    return ''