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
        lp_model = label_propagation.LabelSpreading(gamma=0.25, max_iter=50)
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
    threadObjects = pd.read_json(inputFilenameForAllThreads)

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



### Here are some testing routines if this file needs to be run in isolation:


labelled_threads_s = [{'threadId': 'ea4b2c65d955115', 'classId': 0}, {'threadId': 'e9d7aaf535da91d', 'classId': 0}, {'threadId': 'ea26ce2bdd3f46c', 'classId': 1}, {'threadId': 'ea3c5d9144d3daf', 'classId': 2}, {'threadId': 'e94b70e1ff9cc44', 'classId': 3}, {'threadId': 'ea45f20d9f60580', 'classId': 1}, {'threadId': 'e9bb24e199dd764', 'classId': 3}, {'threadId': 'ea9c3f72f79e166', 'classId': 3}, {'threadId': 'ea4541f38470e9a', 'classId': 3}, {'threadId': 'e9d8c184bb6effd', 'classId': 2}, {'threadId': 'ea67daafe887be7', 'classId': 3}, {'threadId': 'ea3ae7ea0c7922e', 'classId': 0}, {'threadId': 'ea35da2895713c2', 'classId': 1}, {'threadId': 'e9c97302c480140', 'classId': 1}, {'threadId': 'e9cf16b999c3254', 'classId': 3}, {'threadId': 'e9a789979340149', 'classId': 1}, {'threadId': 'e9c8e85af19b664', 'classId': 1}, {'threadId': 'e9bebeb8a35f113', 'classId': 2}, {'threadId': 'ea091df7cba5f30', 'classId': 0}, {'threadId': 'e9b5397a5adc933', 'classId': 1}, {'threadId': 'e9a6e91d55310b3', 'classId': 0}, {'threadId': 'ea1ce65a045a5ee', 'classId': 0}, {'threadId': 'e948f19c1d2d985', 'classId': 3}, {'threadId': 'ea69d1b7934f4d0', 'classId': 3}, {'threadId': 'e9e049e4392fff2', 'classId': 0}, {'threadId': 'e990c835e52b4be', 'classId': 0}, {'threadId': 'e9fcf47d200bf40', 'classId': 2}, {'threadId': 'ea31a4e3b47f306', 'classId': 3}, {'threadId': 'e9e3a236d5fffb8', 'classId': 1}, {'threadId': 'e9e4abd2f76d96c', 'classId': 0}, {'threadId': 'e978d94d58e80e4', 'classId': 0}, {'threadId': 'e9edf1138d10a4a', 'classId': 0}, {'threadId': 'ea54a3087fbcddb', 'classId': 2}, {'threadId': 'ea7f1e05d5c5d28', 'classId': 0}, {'threadId': 'ea696198678e28b', 'classId': 3}, {'threadId': 'e9c04c5d3461bf8', 'classId': 3}, {'threadId': 'e9b78d9a378d155', 'classId': 0}, {'threadId': 'e94cec8c02d8f72', 'classId': 0}, {'threadId': 'ea216b24e6d1d1b', 'classId': 3}, {'threadId': 'e9b9cf10ec332bc', 'classId': 3}, {'threadId': 'e9c03a5a69e4137', 'classId': 0}, {'threadId': 'e9bfb24beb430ae', 'classId': 2}, {'threadId': 'eb08a2c67dd18f6', 'classId': 3}, {'threadId': 'e9a8a274c329d49', 'classId': 0}, {'threadId': 'ea2b2b7b29a7e3f', 'classId': 2}, {'threadId': 'ea4a736ca8d725c', 'classId': 2}, {'threadId': 'ea26c2f87b84062', 'classId': 1}, {'threadId': 'e9edfa883b4e822', 'classId': 2}, {'threadId': 'eb06c262b169487', 'classId': 0}, {'threadId': 'e9d939f82ee3deb', 'classId': 2}]


performThreadModelling(labelled_threads_s)



