from flask import Flask, request
from flask_cors import CORS

import json
import numpy as np
import logging

# NOTE: this doesn't seem to work before doing some editing on the __init__.py  and some restructuring, so moved the code over here for now
#from data.threadModelling import performThreadModelling

app = Flask(__name__)
CORS(app)

filename = 'data/threads-100_revV2.json'
all_threads = None # Store all threads from the local data file
if not all_threads:
    with open(filename, 'r') as f:
        all_threads = json.load(f)

model_name = '' # Initially, no model is loaded

######################
### for convenience embed the modelling here for now

import numpy as np
from scipy import stats
import pandas as pd
import pickle

from sklearn import datasets
from sklearn.semi_supervised import label_propagation
from sklearn.metrics import classification_report, confusion_matrix

# Number of items to label at each iteration of the AL pipeline
numberOfItemsToLabel = 10

inputFilenameForAllThreads = 'threads-100_revV2.json'
# this is the array/list that keeps track of all the manually labelled observations and their labels
# this file is saved across runs and loaded back in



proxyLabels = ["SenderDiversity", "PaceOfInteractionAvgGap", "SenderDiversityEntropy", "ParticipantGrowth", "ParticipantSizeVariation", "Engagement"]


def is_file_accessible(path, mode='r'):
    """
    Check if the file or directory at `path` can
    be accessed by the program using `mode` open flags.
    """
    try:
        f = open(path, mode)
        f.close()
    except IOError:
        return False
    return True

def loadOrCreateCumulativeThreadData(cumulative_threadIDs_file, cumulative_threadlabels_file):
    """Checks if there is already existing labelling, otherwise creates files for storing them"""
    # First load the IDs
    if is_file_accessible(cumulative_threadIDs_file):
        # Load from file
        with open(cumulative_threadIDs_file, 'rb') as file:
            cumulativeThreadIDs = np.load(file)
        print ("Loading cumulative threadClassIDs")
    else:
        cumulativeThreadIDs = np.asarray([])
        print("creating a new cumulative threadClassIDs")

    # Then the labels
    if is_file_accessible(cumulative_threadlabels_file):
        # Load from file
        with open(cumulative_threadlabels_file, 'rb') as file:
            cumulativeThreadClassLabels = np.load(file)
        print ("Loading cumulative threadClassLabel")
    else:
        cumulativeThreadClassLabels = np.asarray([])
        print("creating a new cumulative threadClassLabel")

    return cumulativeThreadIDs, cumulativeThreadClassLabels

def loadOrCreateModel(pkl_model_filename):
    """Checks if there is already an existing model, otherwise creates a new one"""
    # Check if a pickle file for a model is available already
    if is_file_accessible(pkl_model_filename):
        # Load from file
        with open(pkl_model_filename, 'rb') as file:
            pickle_model = pickle.load(file)
        print ("Loading model from file.")
        lp_model = pickle_model
    else:
        lp_model = label_propagation.LabelSpreading(gamma=0.25, max_iter=5)
        print("building a new model")
    return lp_model

def identifyItemsTolabel(lp_model, numberOfSamples, indecesOfUnLabelledIDs):
    """This is sampling procedure to choose records for the AL loop"""
    # Currently using an uncertainty criteria
    # We can adapt ModAL here for a richer selection of strategies
    # compute the entropies of transduced label distributions

    pred_entropies = stats.distributions.entropy(
        lp_model.label_distributions_.T)

    # select up to 5 digit examples that the classifier is most uncertain about
    uncertainty_index = np.argsort(pred_entropies)[::-1]
    uncertainty_index = uncertainty_index[
                            np.in1d(uncertainty_index, indecesOfUnLabelledIDs)][:numberOfSamples]

    return list(uncertainty_index)

def performThreadModelling(newThreadLabelObjects):

    # first some file names
    model_name = "LP"
    pkl_model_filename = "pickle_model_" + model_name + ".pkl"
    cumulative_threadIDs_file = "cumulativeThreadIDs.npy"
    cumulative_threadlabels_file = "cumulativeThreadLabels.npy"

     # first load the json data
    threadObjects = pd.read_json(filename)

    # and load the labels performed by the user so far
    cumulativeThreadIDs, cumulativeThreadClassLabels = loadOrCreateCumulativeThreadData(cumulative_threadIDs_file, cumulative_threadlabels_file)

    allThreadIDs = np.asarray(threadObjects['threadId'])
    allThreadProxies = threadObjects[proxyLabels].as_matrix()

    newLabelledIDs = np.asarray(list(t['threadId'] for t in newThreadLabelObjects))
    newLabelledClasses = np.asarray(list(t['classId'] for t in newThreadLabelObjects))

    # let's append the new list of samples to the cumulative lists

    cumulativeThreadIDs = np.concatenate((cumulativeThreadIDs, newLabelledIDs))

    # Note, we need a check here for duplicates
    # Not great since it is likely to favour the first one, although unclear how
    unique, uniqIndex = np.unique(cumulativeThreadIDs, axis=0, return_index=True)

    cumulativeThreadIDs = unique

    # ok, let's fix duplicates at the label level as well
    cumulativeThreadClassLabels = np.concatenate((cumulativeThreadClassLabels, newLabelledClasses))
    cumulativeThreadClassLabels = cumulativeThreadClassLabels[uniqIndex]

    # Here we move from IDs to actual indices on the numpy array
    sorter = np.argsort(allThreadIDs)
    indecesOfLabelledIDs = sorter[np.searchsorted(allThreadIDs, cumulativeThreadIDs, sorter=sorter)]

    # lets first get an array full of -1s
    y_train = np.full(len(allThreadIDs), -1)
    # and fill those labelled ones
    y_train[indecesOfLabelledIDs] = cumulativeThreadClassLabels
    # training set is now ready

    lp_model = loadOrCreateModel(pkl_model_filename)

    # ok, this is where the model is training
    lp_model.fit(allThreadProxies, y_train)

    # This is where we get the predicted classes for all
    all_predicted_labels = lp_model.transduction_

    ######## Here is the saving phase #######
    ### First the model
    with open(pkl_model_filename, 'wb') as file:
        pickle.dump(lp_model, file)
    ### and then the arrays
    np.save(cumulative_threadIDs_file, cumulativeThreadIDs)
    np.save(cumulative_threadlabels_file, cumulativeThreadClassLabels)
    #########################################

    ######## Here is the returning phase #######
    allIndices = np.arange(len(allThreadIDs))
    indecesOfUnLabelledIDs = np.setdiff1d(allIndices, indecesOfLabelledIDs)

    # this is an additional step to do if we wanted to quality checking
    # true_labels = y[unlabeled_indices]

    results_dictionary = dict(zip(allThreadIDs.tolist(), all_predicted_labels.tolist()))
    print("Results::: ", results_dictionary)

    recommended_thread_IDs_for_labelling = identifyItemsTolabel(lp_model, numberOfItemsToLabel, indecesOfUnLabelledIDs)
    recommended_threads_for_labelling = allThreadIDs[recommended_thread_IDs_for_labelling].tolist()

    return results_dictionary, recommended_threads_for_labelling



######################

# model endpoint
@app.route("/model")
def model():
    # Modelling
    data = request.args.get('data', '')
    labelled_threads = json.loads(data) # This is a list of dictionary { threadId, classId }
    #app.logger.info(labelled_threads)
    #predicted_all_threads = build_dummy_model(labelled_threads) # To be replaced by proper active learning modelling
    predicted_all_threads, recommended_samples = performThreadModelling(labelled_threads)  # To be replaced by proper active learning modelling
    app.logger.info('----------------- Predicted --------------')
    app.logger.info(predicted_all_threads)
    app.logger.info('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
    app.logger.info('----------------- All samples --------------')
    app.logger.info(recommended_samples)
    app.logger.info('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
    # Getting recommendations
    recommend = request.args.get('rec', '') == 'true'
    #recommended_samples = [] # Return empty list if no recommendation required
    if not recommend:
        #recommended_samples = get_dummy_recommended_samples() # To be replaced by proper active learning modelling
        recommended_samples = [] # Return empty list if no recommendation required

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