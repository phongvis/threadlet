import numpy as np
from scipy import stats

from sklearn import datasets
from sklearn.semi_supervised import label_propagation
from sklearn.metrics import classification_report, confusion_matrix

# Number of items to label at each iteration of the AL pipeline
numberOfItemsToLabel = 10

def build_dummy_model(labelled_threads):
    "Return random labels for the entire dataset as a dictionary { threadId: classId }."
    classes = get_available_classes(labelled_threads)
    labels = np.random.choice(classes, size=len(all_threads), replace=True).tolist()
    labelled_all_threads = { t['threadId']: labels[i] for i, t in enumerate(all_threads) }
    return labelled_all_threads

def get_available_classes(labelled_threads):
    "Return a list of classes appeared in the threads."
    return list(set(t['classId'] for t in labelled_threads))

def performThreadModelling(model_name, labelled_threads):

    classes = get_available_classes(labelled_threads)

    # Check if a pickle file for a model is available already
    if is_model_accessible(model_name):
        lp_model = 0
    else:
        lp_model = label_propagation.LabelSpreading(gamma=0.25, max_iter=5)


    lp_model.fit(X, y_train)

    predicted_labels = lp_model.transduction_[unlabeled_indices]
    true_labels = y[unlabeled_indices]


def identifyItemsTolabel(lp_model):
    # Currently using an uncertainty criteria
    # We can adapt ModAL here for a richer selection of strategies
    # compute the entropies of transduced label distributions
    pred_entropies = stats.distributions.entropy(
        lp_model.label_distributions_.T)

    # select up to 5 digit examples that the classifier is most uncertain about
    uncertainty_index = np.argsort(pred_entropies)[::-1]
    uncertainty_index = uncertainty_index[
                            np.in1d(uncertainty_index, unlabeled_indices)][:5]

    return

def is_model_accessible(path, mode='r'):
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