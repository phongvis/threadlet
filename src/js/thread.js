/**
 * A visualization of an email thread.
 * Data input:
 * - array of messages, each has:
 *  - messageId, subject, sender, time
 *  - array of recipients, each has email and type
 */
pv.vis.thread = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 5, right: 10, bottom: 5, left: 5 },
        radius = 5,
        personHeight = 16,
        personLabelWidth = 90; // this value is also defined in css

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height; // Size of the main content, excluding margins

    /**
     * Accessors.
     */
    let messageId = d => d.messageId,
        subject = d => d.subject,
        sender = d => d.sender,
        time = d => d.timestamp,
        recipients = d => d.recipients,
        email = d => d.email,
        type = d => d.type,
        lineId = d => d.id;

    /**
     * Data binding to DOM elements.
     */
    let data,
        personData,
        personLookup,
        lineData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        personContainer,
        lineContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        xSeqScale = d3.scaleLinear(),
        xContScale = d3.scaleLinear();

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-thread');
                lineContainer = visContainer.append('g').attr('class', 'lines');
                personContainer = visContainer.append('g').attr('class', 'persons');

                this.visInitialized = true;
            }

            data = _data.sort((a, b) => d3.ascending(time(a), time(b)));
            update();
        });

        dataChanged = false;
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xSeqScale.range([personLabelWidth, width]);
        xContScale.range([personLabelWidth, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            personData = buildPersonData(data);
            addMessageInstances(data);
            lineData = buildLineData(personData);

            xSeqScale.domain([0, data.length - 1]);
        }

        // Updates that depend on both data and display change
        layoutPersons(personData);
        layoutMessages(data);
        layoutLines(lineData, data);

        /**
         * Draw.
         */
        const persons = personContainer.selectAll('.person').data(personData, d => d.email);
        persons.enter().append('g').attr('class', 'person').call(enterPersons)
            .merge(persons).call(updatePersons);
        persons.exit().transition().attr('opacity', 0).remove();

        const lines = lineContainer.selectAll('.line').data(lineData, lineId);
        lines.enter().append('g').attr('class', 'line').call(enterLines)
            .merge(lines).call(updateLines);
        lines.exit().transition().attr('opacity', 0).remove();
    }

    function buildPersonData(messages) {
        // Persons include both senders and recipients.
        // Senders are added first, sorted by time.
        // Then recipients who don't send are added, sort by time as well.
        // Messages are expected to be already sorted by time.
        const persons = [];
        personLookup = {};

        function addPerson(s) {
            if (!personLookup[s]) {
                persons.push({ email: s, instances: [] });
                personLookup[s] = _.last(persons);
            }
        }

        messages.map(sender).forEach(addPerson);

        messages.map(recipients).forEach(r => {
            r.map(email).forEach(addPerson);
        });

        return persons;
    }

    function addMessageInstances(messages) {
        messages.forEach((m, i) => {
            const reLookup = {};

            // Sender can be in the recipients
            personLookup[sender(m)].instances.push(createNewMessageInstance(i, true));
            reLookup[sender(m)] = 1;

            recipients(m).forEach(r => {
                // There can be duplicate recipients in a message with different types, or even simply identical duplicates?
                if (!reLookup[email(r)]) {
                    personLookup[email(r)].instances.push(createNewMessageInstance(i, false, type(r)));
                    reLookup[email(r)] = 1;
                }
            });
        });
    }

    function createNewMessageInstance(idx, isSender, type) {
        return {
            messageIdx: idx, // Index of the message in the array of messages
            isSender: isSender,
            type: type
        };
    }

    function buildLineData(persons) {
        return _.flatten(persons.map(extractLinesFromPerson));
    }

    function extractLinesFromPerson(p) {
        // For a person, a line connects consecutive message instances (no other messages in-between)
        let lastMessageIdx = p.instances[0].messageIdx,
            firstMessageIdx = lastMessageIdx;
        const lines = [];

        function addLine() {
            lines.push({
                sourceIdx: firstMessageIdx,
                targetIdx: lastMessageIdx,
                personEmail: p.email,
                id: p.email + '-' + firstMessageIdx + '-' + lastMessageIdx
            });
        }

        p.instances.slice(1).forEach(m => {
            // The line breaks if the current messageIdx is not equal to the previous one + 1
            if (m.messageIdx !== lastMessageIdx + 1) {
                if (lastMessageIdx !== firstMessageIdx) {
                    addLine();
                }

                firstMessageIdx = m.messageIdx;
            }

            lastMessageIdx = m.messageIdx;
        });

        // Add the last one as it doesn't break yet
        if (lastMessageIdx !== firstMessageIdx) {
            addLine();
        }

        return lines;
    }

    function enterPersons(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        const fo = container.append('foreignObject').attr('width', '100%').attr('height', '100%');

        fo.append('xhtml:div').attr('class', 'label')
            .text(d => d.email.substr(0, d.email.indexOf('@')));
        fo.append('title')
            .text(d => d.email);
    }

    function updatePersons(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            layoutInstances(d.instances);
            const instances = container.selectAll('.instance').data(d.instances, d => d.messageIdx);
            instances.enter().append('g').attr('class', 'instance').call(enterInstances)
                .merge(instances).call(updateInstances);
            instances.exit().transition().attr('opacity', 0).remove();
        });
    }

    function enterInstances(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('circle')
            .attr('r', radius);
    }

    function updateInstances(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.classed('sender', d.isSender);
        });
    }

    function enterLines(selection) {
        const container = selection
            .attr('opacity', 0);

        container.append('line');
    }

    function updateLines(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('opacity', 1);

            container.select('line')
                .attr('x1', d.x1)
                .attr('y1', d.y)
                .attr('x2', d.x2)
                .attr('y2', d.y);
        });
    }

    function layoutPersons(persons) {
        persons.forEach((p, i) => {
            p.x = 0;
            p.y = personHeight * i;
        });
    }

    function layoutMessages(messages) {
        messages.forEach((m, i) => {
            m.x = xSeqScale(i);
            m.y = 0;
        });
    }

    function layoutInstances(instances) {
        instances.forEach(i => {
            i.x = data[i.messageIdx].x;
            i.y = (personHeight - radius) / 2 + 1;
        });
    }

    function layoutLines(lines, messages) {
        lines.forEach(l => {
            l.x1 = messages[l.sourceIdx].x;
            l.x2 = messages[l.targetIdx].x;
            l.y = personLookup[l.personEmail].y + radius + 1;
        });
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
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function() {
        dataChanged = true;
    };

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};