/**
 * An interface to perform labelling.
 */
pv.vis.labelling = function() {
    /**
     * Visual configs.
     */
    let width, height, // Size of the main content, excluding margins
        visTitle = 'Labelling',
        modelName = '',
        labellingMode,
        editingClass,
        isEdittingClass = false,
        isRecommendingSamples = true;

    /**
     * Data.
     */
    let labelData,
        incrementalId = 0,
        allIds;

    /**
     * DOM.
     */
    let visContainer,
        settingContainer;

    /**
     * D3.
     */
    let colorScale;
    const listeners = d3.dispatch('label', 'new', 'load', 'update', 'testUpdate', 'save', 'delete');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('div').attr('class', 'pv-labelling');
                addSettings(container);

                visContainer = container.append('div').attr('class', 'main-vis all-labels field is-grouped is-grouped-multiline');

                this.visInitialized = true;
            }

            labelData = _data;
            incrementalId = labelData.length;
            // addTestClasses();

            update();
            // testUpdateModel();
        });
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        pv.enterUpdateDiv(labelData, visContainer, enterLabels, updateLabels, d => d.id, 'class-label');
    }

    function enterLabels(container) {
        container = container.append('div').attr('class', 'tags has-addons');
        container.append('a').attr('class', 'class-name tag button is-medium')
            .on('click', function(d) {
                listeners.call('label', module, d.id);
            });

        // Edit button
        container.append('a').attr('class', 'class-edit tag is-medium').text('✎')
            .on('click', function(d) {
                editingClass = d;
                settingContainer.select('.modal .input').node().value = d.label;
                displayModal(true);
                settingContainer.select('.modal .input').node().focus();
            });

        // Delete button
        container.append('a').attr('class', 'class-delete tag is-delete is-medium')
            .on('click', function(d) {
                labelData.splice(labelData.indexOf(d), 1);
                update();
                listeners.call('delete', module, d.id);
            });
    }

    function updateLabels(selection) {
        selection.each(function(d) {
            const container = d3.select(this);
            container.select('.class-name')
                .style('background-color', colorScale(d.id))
                .text(d.label);

            container.select('.class-edit').classed('hidden', !isEdittingClass);
            container.select('.class-delete').classed('hidden', !isEdittingClass);
        });
    }

    function addSettings(container) {
        settingContainer = container.append('div').attr('class', 'settings')
            .html(`
                <div class='vis-header'>
                    <div class='title'>${visTitle}</div>
                    <label class='setting checkbox edit-mode'><input type='checkbox'> Edit Class</label>
                    <button class='setting new-label'>New Class</button>
                    <label class='setting checkbox recommend'><input type='checkbox'> Recommend Samples</label>
                    <button class='setting update-model'>Update</button>
                    <button class='setting save-model'>Save</button>
                    <label class='setting file-container'>
                        Load
                        <input type='file' class='load-model'>
                    </label>
                    <button class='setting new-model'>New</button>
                    <label class='setting model-name'>${modelName}</label>
                </div>
            `);

        handleEditMode();
        handleRecommendingSamples();
        handleNewClass();
        handleNewModel();
        handleUpdateModel();
        handleSaveModel();
        handleLoadModel();
        handleSaveLoadButtons();
        addTestButton();
    }

    function handleEditMode() {
        // Default value of editting checbox
        settingContainer.select('.edit-mode input').node().checked = isEdittingClass;
        settingContainer.select('.edit-mode input').on('change', function() {
            isEdittingClass = this.checked;
            update();
        });
    }

    function handleRecommendingSamples() {
        // Default value of recommending checkbox
        settingContainer.select('.recommend input').node().checked = isRecommendingSamples;
        settingContainer.select('.recommend input').on('change', function() {
            isRecommendingSamples = this.checked;
            update();
        });
    }

    function handleNewClass() {
        // Add modal dialog
        const dialog = settingContainer.append('div').attr('class', 'modal new-class')
            .html(`
                <div class='modal-background'></div>
                <div class='modal-card' style='width: 300px'>
                    <header class='modal-card-head'>
                        <p class='modal-card-title'>Enter label name</p>
                    </header>
                    <section class='modal-card-body'>
                        <input class='input is-medium' type='text'>
                    </section>
                    <footer class='modal-card-foot'>
                        <button class='button is-success'>Save changes</button>
                        <button class='button cancel'>Cancel</button>
                    </footer>
                </div>
            `);

        // Class manipulation
        settingContainer.select('.new-label')
            .on('click', function() {
                labellingMode = 'new';
                displayModal(dialog, true);
                dialog.select('input').node().focus();
            });

        // Cancel
        dialog.select('.cancel')
            .on('click', function() {
                displayModal(dialog, false);
            });

        // OK - add new class
        dialog.select('.is-success')
            .on('click', function() {
                const label = dialog.select('input').node().value;

                if (labellingMode === 'new') {
                    labelData.push({ id: incrementalId++, label: label });
                } else {
                    editingClass.label = label;
                }

                update();
                dialog.select('input').node().value = '';
                displayModal(dialog, false);
            });
    }

    function displayModal(container, visibility) {
        container.classed('is-active', visibility);
    }

    function handleNewModel() {
        // Add modal dialog
        const dialog = settingContainer.append('div').attr('class', 'modal new-model')
            .html(`
                <div class='modal-background'></div>
                <div class='modal-card' style='width: 300px'>
                    <header class='modal-card-head'>
                        <p class='modal-card-title'>Enter model name</p>
                    </header>
                    <section class='modal-card-body'>
                        <input class='input is-medium' type='text'>
                    </section>
                    <footer class='modal-card-foot'>
                        <button class='button is-success'>Save changes</button>
                        <button class='button cancel'>Cancel</button>
                    </footer>
                </div>
            `);

        // Model manipulation
        settingContainer.select('.new-model')
            .on('click', function() {
                displayModal(dialog, true);
                dialog.select('input').node().focus();
            });

        // Cancel
        dialog.select('.cancel')
            .on('click', function() {
                displayModal(dialog, false);
            });

        // OK - create a new model
        dialog.select('.is-success')
            .on('click', function() {
                modelName = dialog.select('input').node().value;
                dialog.select('input').node().value = '';
                displayModal(dialog, false);
                handleSaveLoadButtons();
                listeners.call('new', module, modelName);
            });
    }

    function handleUpdateModel() {
        settingContainer.select('.update-model').on('click', function() {
            listeners.call('update', module, isRecommendingSamples);
        });
    }

    function handleSaveModel() {
        settingContainer.select('.save-model').on('click', function() {
            listeners.call('save', module, labelData);
        });
    }

    function handleLoadModel() {
        settingContainer.select('.load-model').node().addEventListener('change', function(e) {
            pv.readFile(e, function(text) {
                modelName = (e.target.files[0]).name.replace('.json', '');
                handleSaveLoadButtons();
                const data = JSON.parse(text);
                data.modelName = modelName;
                listeners.call('load', module, data);
            })
        });
    }

    function handleSaveLoadButtons() {
        const disabled = modelName ? null : true;
        settingContainer.select('.save-model').attr('disabled', disabled).style('cursor', disabled ? 'default' : 'pointer');
        settingContainer.select('.update-model').attr('disabled', disabled).style('cursor', disabled ? 'default' : 'pointer');

        settingContainer.select('.model-name').text(modelName);
    }

    function addTestButton() {
        settingContainer.select('.vis-header')
            .append('button').attr('class', 'setting test')
            .text('Test')
            .on('click', testUpdateModel);
    }

    function testUpdateModel() {
        // Get a random 50 thread Ids
        const randomIds = d3.shuffle(allIds).slice(0, 50);

        // Create fixed 4 classes
        labelData = _.range(0, 4).map(i => ({ id: i, label: 'Class ' + i }));

        // Create random class assignment
        const labelledThreads = randomIds.map(t => ({
            threadId: t,
            classId: _.random(0, labelData.length - 1)
        }));

        update();
        listeners.call('testUpdate', module, { threads: labelledThreads, recommend: isRecommendingSamples });
    }

    function addTestClasses() {
        labelData.push({ id: 0, label: 'Class 0' }, { id: 1, label: 'Class 1' });
        incrementalId = labelData.length;
    }

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function(value) {
        if (!arguments.length) return visWidth;
        visWidth = value;
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function(value) {
        if (!arguments.length) return visHeight;
        visHeight = value;
        return this;
    };

    /**
     * Sets/gets the color scale of the visualization.
     */
    module.colorScale = function(value) {
        if (!arguments.length) return colorScale;
        colorScale = value;
        return this;
    };

    /**
     * Sets all the thread Ids, probably only for testing.
     */
    module.allIds = function(value) {
        allIds = value;
        return this;
    }

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};