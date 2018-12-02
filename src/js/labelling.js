/**
 * An interface to perform labelling.
 */
pv.vis.labelling = function() {
    /**
     * Visual configs.
     */
    let visTitle = 'Labelling',
        labellingMode,
        editingClass,
        isEdittingClass = false,
        isRecommendingSamples = true;

    /**
     * Data.
     */
    let labelData = [ { id: 0, label: 'Class 1' }, { id: 1, label: 'Class 2' } ],
        incrementalId = labelData.length,
        allIds,
        classLookup = {}; // threadId -> classId

    /**
     * DOM.
     */
    let visContainer,
        settingContainer;

    /**
     * D3.
     */
    let colorScale;
    const listeners = d3.dispatch('update');

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

            update();
            testUpdateModel();
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
        container.append('a').attr('class', 'class-name tag button is-medium');

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
                    <button class='setting update-model'>Update Model</button>
                </div>
                <div class='modal'>
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
                </div>
            `);

        handleEditMode(container);
        handleRecommendingSamples(container);
        handleNewClass(container);
        handleUpdateModel(container);
        addTestButton(container);
    }

    function handleEditMode(container) {
        // Default value of editting checbox
        container.select('.edit-mode input').node().checked = isEdittingClass;
        container.select('.edit-mode input').on('change', function() {
            isEdittingClass = this.checked;
            update();
        });
    }

    function handleRecommendingSamples(container) {
        // Default value of recommending checkbox
        container.select('.recommend input').node().checked = isRecommendingSamples;
        container.select('.recommend input').on('change', function() {
            isRecommendingSamples = this.checked;
            update();
        });
    }

    function handleNewClass(container) {
        // Class manipulation
        container.select('.new-label')
            .on('click', function() {
                labellingMode = 'new';
                displayModal(true);
                container.select('.modal input').node().focus();
            });

        container.select('.modal .cancel')
            .on('click', function() {
                displayModal(false);
            });

        container.select('.modal .is-success')
            .on('click', function() {
                const label = container.select('.modal .input').node().value;

                if (labellingMode === 'new') {
                    labelData.push({ id: incrementalId++, label: label });
                } else {
                    editingClass.label = label;
                }

                update();
                container.select('.modal .input').node().value = '';
                displayModal(false);
            });
    }

    function displayModal(visibility) {
        settingContainer.select('.modal').classed('is-active', visibility);
    }

    function handleUpdateModel(container) {
    }

    function addTestButton(container) {
        container.select('.vis-header')
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
        listeners.call('update', module, { threads: labelledThreads, recommend: isRecommendingSamples });
    }

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